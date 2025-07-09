// Global Leaderboard Integration for Fallphabet
// Handles all Supabase operations for the global leaderboard

class GlobalLeaderboardManager {
  constructor() {
    this.supabase = window.supabaseClient;
    this.isConnected = false;
    this.testConnection();
  }

  // Test connection to Supabase
  async testConnection() {
    try {
      const { data, error } = await this.supabase
        .from('leaderboard')
        .select('count')
        .limit(1);
      
      if (error) {
        console.error('Supabase connection error:', error);
        this.isConnected = false;
      } else {
        console.log('✅ Supabase connected successfully');
        this.isConnected = true;
      }
    } catch (err) {
      console.error('Supabase connection failed:', err);
      this.isConnected = false;
    }
  }

  // Submit a score to the global leaderboard
  async submitScore(scoreData) {
    if (!this.isConnected) {
      console.warn('Supabase not connected, using local storage fallback');
      return this.submitToLocalStorage(scoreData);
    }

    try {
      let result;

      if (scoreData.gameMode === 'daily_challenge') {
        // Daily challenge with one attempt per day limit
        // Ensure attempt_date and daily_seed are present
        const today = new Date();
        const attempt_date = scoreData.attemptDate || today.toISOString().slice(0, 10); // 'YYYY-MM-DD'
        // Generate daily_seed using the same logic as backend (MD5 hash of date + salt, first 10 chars)
        let daily_seed = scoreData.dailySeed;
        if (!daily_seed) {
          // Fallback JS implementation of backend's get_daily_seed
          // MD5 implementation (simple, not cryptographically secure, but matches backend intent)
          function md5(str) {
            return CryptoJS.MD5(str).toString();
          }
          if (typeof CryptoJS !== 'undefined') {
            daily_seed = md5(attempt_date + 'fallphabet_daily_2024').substring(0, 10);
          } else {
            // If CryptoJS is not available, fallback to a simple hash
            daily_seed = btoa(attempt_date).substring(0, 10);
          }
        }
        const { data, error } = await this.supabase
          .rpc('submit_daily_challenge_score', {
            player_name: scoreData.playerName,
            score: scoreData.score,
            attempt_date,
            daily_seed
          });

        if (error) {
          console.error('Daily challenge submission error:', error);
          return { success: false, error: error.message };
        }

        if (!data.success) {
          return { success: false, error: data.error };
        }

        result = { 
          success: true, 
          data: data,
          rank: data.rank,
          totalParticipants: data.total_participants
        };
      } else {
        // Taptile mode (unlimited attempts)
        const { data, error } = await this.supabase
          .from('leaderboard')
          .insert([{
            player_name: scoreData.playerName,
            score: scoreData.score,
            words_used: scoreData.wordsUsed,
            game_mode: scoreData.gameMode,
            game_duration_seconds: scoreData.gameDurationSeconds,
            max_chain_multiplier: scoreData.maxChainMultiplier
          }])
          .select();

        if (error) {
          console.error('Error submitting score:', error);
          return { success: false, error: error.message };
        }

        result = { success: true, data: data[0] };
      }

      console.log('✅ Score submitted to global leaderboard:', result);
      return result;
    } catch (err) {
      console.error('Error submitting score:', err);
      return { success: false, error: err.message };
    }
  }

  // Get top scores for a specific game mode
  async getTopScores(gameMode, limit = 10) {
    if (!this.isConnected) {
      console.warn('Supabase not connected, using local storage fallback');
      return this.getLocalTopScores(gameMode, limit);
    }

    try {
      let data, error;

      if (gameMode === 'daily_challenge') {
        // Get today's daily challenge leaderboard
        const result = await this.supabase
          .rpc('get_daily_challenge_leaderboard');
        
        data = result.data;
        error = result.error;
      } else {
        // Get all-time leaderboard for other modes
        const result = await this.supabase
          .from('leaderboard')
          .select('*')
          .eq('game_mode', gameMode)
          .order('score', { ascending: false })
          .limit(limit);
        
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Error fetching top scores:', error);
        return { success: false, error: error.message };
      }

      // Add rank to each entry if not already present
      const rankedData = data.map((entry, index) => ({
        ...entry,
        rank: entry.rank || index + 1
      }));

      console.log(`✅ Fetched ${rankedData.length} top scores for ${gameMode}`);
      return { success: true, data: rankedData };
    } catch (err) {
      console.error('Error fetching top scores:', err);
      return { success: false, error: err.message };
    }
  }

  // Get player's best score for a game mode
  async getPlayerBestScore(playerName, gameMode) {
    if (!this.isConnected) {
      console.warn('Supabase not connected, using local storage fallback');
      return this.getLocalPlayerBestScore(playerName, gameMode);
    }

    try {
      const { data, error } = await this.supabase
        .from('leaderboard')
        .select('*')
        .eq('player_name', playerName)
        .eq('game_mode', gameMode)
        .order('score', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching player best score:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data[0] || null };
    } catch (err) {
      console.error('Error fetching player best score:', err);
      return { success: false, error: err.message };
    }
  }

  // Get player's rank for a specific score
  async getPlayerRank(score, gameMode) {
    if (!this.isConnected) {
      console.warn('Supabase not connected, cannot get rank');
      return { success: false, error: 'Not connected' };
    }

    try {
      const { count, error } = await this.supabase
        .from('leaderboard')
        .select('*', { count: 'exact', head: true })
        .eq('game_mode', gameMode)
        .gt('score', score);

      if (error) {
        console.error('Error getting player rank:', error);
        return { success: false, error: error.message };
      }

      const rank = count + 1;
      return { success: true, rank };
    } catch (err) {
      console.error('Error getting player rank:', err);
      return { success: false, error: err.message };
    }
  }

  // Local storage fallback methods
  submitToLocalStorage(scoreData) {
    try {
      const leaderboard = JSON.parse(localStorage.getItem('fallphabet_leaderboard') || '[]');
      const newEntry = {
        id: Date.now().toString(),
        player_name: scoreData.playerName,
        score: scoreData.score,
        words_used: scoreData.wordsUsed,
        game_mode: scoreData.gameMode,
        game_duration_seconds: scoreData.gameDurationSeconds,
        max_chain_multiplier: scoreData.maxChainMultiplier,
        created_at: new Date().toISOString()
      };
      
      leaderboard.push(newEntry);
      localStorage.setItem('fallphabet_leaderboard', JSON.stringify(leaderboard));
      
      return { success: true, data: newEntry };
    } catch (err) {
      console.error('Error saving to local storage:', err);
      return { success: false, error: err.message };
    }
  }

  getLocalTopScores(gameMode, limit = 10) {
    try {
      const leaderboard = JSON.parse(localStorage.getItem('fallphabet_leaderboard') || '[]');
      const filteredScores = leaderboard
        .filter(entry => entry.game_mode === gameMode)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((entry, index) => ({
          ...entry,
          rank: index + 1
        }));
      
      return { success: true, data: filteredScores };
    } catch (err) {
      console.error('Error reading from local storage:', err);
      return { success: false, error: err.message };
    }
  }

  getLocalPlayerBestScore(playerName, gameMode) {
    try {
      const leaderboard = JSON.parse(localStorage.getItem('fallphabet_leaderboard') || '[]');
      const playerScores = leaderboard
        .filter(entry => entry.player_name === playerName && entry.game_mode === gameMode)
        .sort((a, b) => b.score - a.score);
      
      return { success: true, data: playerScores[0] || null };
    } catch (err) {
      console.error('Error reading from local storage:', err);
      return { success: false, error: err.message };
    }
  }

  // Render leaderboard in the modal
  async renderLeaderboard(gameMode = 'fallphabet_taptile') {
    const leaderboardContent = document.getElementById('leaderboard-content');
    if (!leaderboardContent) return;

    leaderboardContent.innerHTML = '<div class="loading">Loading leaderboard...</div>';

    // Check connection status first
    if (!this.isConnected) {
      console.warn('Supabase not connected, checking connection...');
      await this.testConnection();
    }

    try {
      const result = await this.getTopScores(gameMode, 20);
      if (!result.success) {
        leaderboardContent.innerHTML = `<div class="error">Error loading leaderboard: ${result.error}</div>`;
        return;
      }
      if (result.data.length === 0) {
        leaderboardContent.innerHTML = '<div class="no-scores">No scores yet! Be the first to play!</div>';
        return;
      }
      const leaderboardHTML = `
        <div class="leaderboard-header">
          <h3>Top ${gameMode === 'fallphabet_taptile' ? 'Taptile' : 'Daily Challenge'} ${gameMode === 'daily_challenge' ? 'Words Used' : 'Scores'}</h3>
        </div>
        <div class="leaderboard-list">
          ${result.data.map((entry, index) => `
            <div class="leaderboard-entry ${index < 3 ? 'top-three' : ''}">
              <div class="rank">#${entry.rank}</div>
              <div class="player-info">
                <div class="player-name">${this.escapeHtml(entry.player_name)}</div>
                <div class="player-stats">
                  ${gameMode === 'daily_challenge' ? 
                    `Words: ${entry.words_used} • Top Word: ${this.escapeHtml(entry.top_word || 'N/A')}` :
                    `Speed: ${entry.max_chain_multiplier}x • Time: ${entry.game_duration_seconds}s`
                  }
                </div>
              </div>
              ${gameMode === 'daily_challenge' ? '' : `<div class="score">${entry.score}</div>`}
            </div>
          `).join('')}
        </div>
      `;
      leaderboardContent.innerHTML = leaderboardHTML;
    } catch (err) {
      leaderboardContent.innerHTML = `<div class='error'>Leaderboard error: ${err.message}</div>`;
      console.error('Leaderboard render error:', err);
    }
  }

  // Utility function to escape HTML
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Get player name from localStorage or prompt for it
  getPlayerName() {
    return localStorage.getItem('fallphabet_player_name') || null;
  }

  // Show leaderboard modal and render leaderboard for a given mode
  showLeaderboardModal(gameMode) {
    const leaderboardModal = document.getElementById('leaderboard-modal');
    leaderboardModal.classList.add('show');
    this.renderLeaderboard(gameMode);
  }

  // Show name input modal for score submission
  showNameInputModal(scoreData, callback) {
    const modal = document.createElement('div');
    modal.className = 'name-input-modal';
    modal.innerHTML = `
      <div class="name-input-content">
        <h3>Submit Your Score!</h3>
        <p>You scored <strong>${scoreData.score}</strong> points!</p>
        <div class="input-group">
          <label for="player-name">Enter your name:</label>
          <input type="text" id="player-name" maxlength="20" placeholder="Your name" autocomplete="off">
        </div>
        <div class="modal-actions">
          <button id="submit-score-btn" class="modal-btn primary">Submit Score</button>
          <button id="cancel-score-btn" class="modal-btn">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const nameInput = modal.querySelector('#player-name');
    const submitBtn = modal.querySelector('#submit-score-btn');
    const cancelBtn = modal.querySelector('#cancel-score-btn');

    // Focus on input
    setTimeout(() => nameInput.focus(), 100);

    // Handle submit
    const handleSubmit = async () => {
      const playerName = nameInput.value.trim();
      if (!playerName) {
        nameInput.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      const submissionData = {
        ...scoreData,
        playerName: playerName
      };

      const result = await this.submitScore(submissionData);
      document.body.removeChild(modal);
      if (callback) {
        callback(result, submissionData);
      }
      // Show leaderboard modal for the current mode after name submission
      const gameMode = scoreData.gameMode;
      this.showLeaderboardModal(gameMode);
      // Disable input in the game scene if possible
      if (window.game && window.game.scene && window.game.scene.keys && window.game.scene.keys['GameScene']) {
        const scene = window.game.scene.keys['GameScene'];
        if (scene.disableInput) scene.disableInput();
      }
    };

    // Event listeners
    submitBtn.addEventListener('click', handleSubmit);
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
      if (callback) callback({ success: false, cancelled: true });
    });

    nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSubmit();
      }
    });
  }
}

// Initialize global leaderboard manager
window.globalLeaderboard = new GlobalLeaderboardManager(); 