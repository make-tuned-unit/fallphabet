// Global Leaderboard Integration for Fallphabet
// Handles all Supabase operations for the global leaderboard

console.log('🎯 Leaderboard integration loaded - Version 9 with enhanced debugging - ' + new Date().toISOString());
class GlobalLeaderboardManager {
  constructor() {
    console.log('GlobalLeaderboardManager constructor called');
    this.supabase = window.supabaseClient;
    console.log('Supabase client available:', !!this.supabase);
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
        // Daily Challenge: insert into daily_challenge_leaderboard
        console.log('Submitting daily challenge score:', scoreData);
        const insertData = {
          player_name: scoreData.playerName,
          score: scoreData.score,
          words_used: scoreData.wordsUsed,
          top_word: scoreData.topWord || '',
          top_word_score: scoreData.topWordScore || 0,
          highest_chain: scoreData.maxChainMultiplier || 1,
          attempt_date: new Date().toISOString().split('T')[0],
          daily_seed: scoreData.dailySeed || '',
          created_at: new Date().toISOString(),
        };
        console.log('Insert data:', insertData);
        const { data, error } = await this.supabase
          .from('daily_challenge_leaderboard')
          .insert([insertData])
          .select();

        console.log('Daily challenge submission response - data:', data, 'error:', error);
        if (error) {
          console.error('Daily challenge submission error:', error);
          return { success: false, error: error.message };
        }

        // Set localStorage flag to prevent multiple attempts today (using UTC date)
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem(`daily_challenge_completed_${today}`, 'true');
        console.log('✅ Set localStorage flag for daily challenge completion today (UTC):', today);
        console.log('✅ localStorage flag value after setting:', localStorage.getItem(`daily_challenge_completed_${today}`));

        result = {
          success: true,
          data: data[0],
        };
      } else {
        // Taptile mode: insert into taptile_leaderboard
        const { data, error } = await this.supabase
          .from('taptile_leaderboard')
          .insert([{
            player_name: scoreData.playerName,
            score: scoreData.score,
            words_used: scoreData.wordsUsed,
            game_duration_seconds: Math.round(scoreData.gameDurationSeconds || 0),
            max_chain_multiplier: Math.round(scoreData.maxChainMultiplier || 0),
            created_at: new Date().toISOString(),
          }])
          .select();

        if (error) {
          console.error('Error submitting score:', error);
          return { success: false, error: error.message };
        }

        result = { success: true, data: data[0] };
      }

      console.log('✅ Score submitted to leaderboard:', result);
      
      // Store player name in localStorage for future recognition
      if (scoreData.playerName) {
        localStorage.setItem('fallphabet_player_name', scoreData.playerName);
        console.log('✅ Stored player name in localStorage:', scoreData.playerName);
        console.log('✅ localStorage after storing:', localStorage.getItem('fallphabet_player_name'));
      } else {
        console.log('⚠️ No playerName in scoreData, not storing in localStorage');
      }
      
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
        // Get today's daily challenge leaderboard (using UTC date)
        const today = new Date().toISOString().split('T')[0];
        console.log('🔍 Fetching daily challenge leaderboard for date (UTC):', today);
        const result = await this.supabase
          .from('daily_challenge_leaderboard')
          .select('*')
          .eq('attempt_date', today)
          .order('score', { ascending: false })
          .limit(limit);
        data = result.data;
        error = result.error;
      } else {
        // Get all-time leaderboard for Taptile mode
        const result = await this.supabase
          .from('taptile_leaderboard')
          .select('*')
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
      let data, error;
      if (gameMode === 'daily_challenge') {
        const today = new Date().toISOString().split('T')[0]; // UTC date
        console.log('🔍 Getting player best score for daily challenge date (UTC):', today);
        const result = await this.supabase
          .from('daily_challenge_leaderboard')
          .select('*')
          .eq('player_name', playerName)
          .eq('attempt_date', today)
          .order('score', { ascending: false })
          .limit(1);
        data = result.data;
        error = result.error;
      } else {
        const result = await this.supabase
          .from('taptile_leaderboard')
          .select('*')
          .eq('player_name', playerName)
          .order('score', { ascending: false })
          .limit(1);
        data = result.data;
        error = result.error;
      }
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
      let count, error;
      if (gameMode === 'daily_challenge') {
        const today = new Date().toISOString().split('T')[0];
        const result = await this.supabase
          .from('daily_challenge_leaderboard')
          .select('*', { count: 'exact', head: true })
          .eq('attempt_date', today)
          .gt('score', score);
        count = result.count;
        error = result.error;
      } else {
        const result = await this.supabase
          .from('taptile_leaderboard')
          .select('*', { count: 'exact', head: true })
          .gt('score', score);
        count = result.count;
        error = result.error;
      }
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
        top_word: scoreData.topWord || '',
        top_word_score: scoreData.topWordScore || 0,
        game_mode: scoreData.gameMode,
        game_duration_seconds: Math.round(scoreData.gameDurationSeconds || 0),
        max_chain_multiplier: Math.round(scoreData.maxChainMultiplier || 0),
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
          <h3>Top ${gameMode === 'fallphabet_taptile' ? 'Taptile' : 'Daily Challenge'} ${gameMode === 'daily_challenge' ? 'Top Words' : 'Scores'}</h3>
        </div>
        <div class="leaderboard-list">
          ${result.data.map((entry, index) => `
            <div class="leaderboard-entry ${index < 3 ? 'top-three' : ''}">
              <div class="rank">#${entry.rank}</div>
              <div class="player-info">
                <div class="player-name">${this.escapeHtml(entry.player_name)}</div>
                <div class="player-stats">
                  ${gameMode === 'daily_challenge' ? 
                    `Top Word: "${this.escapeHtml(entry.top_word || 'N/A')}" (${entry.top_word_score || 0} pts) • Words Used: ${entry.words_used}` :
                    `Speed: ${entry.max_chain_multiplier}x • Time: ${entry.game_duration_seconds}s`
                  }
                </div>
              </div>
              <div class="score">${entry.score}</div>
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
    let playerName = localStorage.getItem('fallphabet_player_name') || null;
    console.log('getPlayerName() - localStorage value:', playerName);
    
    if (!playerName || playerName.trim() === '' || playerName.trim().toLowerCase() === 'anonymous') {
      playerName = null;
      console.log('getPlayerName() - invalid name, returning null');
    } else {
      console.log('getPlayerName() - valid name found:', playerName);
    }
    return playerName;
  }

  // Generate a unique player ID based on browser fingerprint
  generatePlayerId() {
    // Try to get existing player ID
    let playerId = localStorage.getItem('fallphabet_player_id');
    
    if (!playerId) {
      // Generate a new player ID based on browser characteristics
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Fallphabet Player ID', 2, 2);
      
      const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        canvas.toDataURL(),
        navigator.hardwareConcurrency || 'unknown',
        navigator.deviceMemory || 'unknown'
      ].join('|');
      
      // Create a hash of the fingerprint
      let hash = 0;
      for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      playerId = 'player_' + Math.abs(hash).toString(36);
      localStorage.setItem('fallphabet_player_id', playerId);
      console.log('Generated new player ID:', playerId);
    }
    
    return playerId;
  }

  // Get player identifier (name if available, otherwise ID)
  getPlayerIdentifier() {
    const playerName = this.getPlayerName();
    if (playerName) {
      return playerName;
    }
    
    // If no name, use player ID
    const playerId = this.generatePlayerId();
    console.log('No player name found, using player ID:', playerId);
    return playerId;
  }

  // Show leaderboard modal and render leaderboard for a given mode
  showLeaderboardModal(gameMode) {
    const leaderboardModal = document.getElementById('leaderboard-modal');
    if (!leaderboardModal) {
      console.error('Leaderboard modal not found');
      return;
    }
    
    leaderboardModal.classList.add('show');
    
    // Use the appropriate rendering method based on game mode
    if (gameMode === 'daily_challenge') {
      // Use the dedicated daily challenge renderer with a small delay to ensure score submission completes
      setTimeout(() => {
        this.renderDailyLeaderboard(leaderboardModal.querySelector('#leaderboard-content'));
      }, 500);
    } else if (gameMode === 'fallphabet_taptile' || gameMode === 'taptile') {
      // Use the dedicated taptile renderer
      this.renderTaptileLeaderboard(leaderboardModal.querySelector('#leaderboard-content'));
    } else {
      // Fallback to generic renderer
      this.renderLeaderboard(gameMode);
    }
  }

  // Show name input modal for score submission
  showNameInputModal(scoreData, callback) {
    console.log('showNameInputModal called with updated version v4');
    const modal = document.createElement('div');
    modal.className = 'responsive-modal';
    modal.innerHTML = `
      <div class="responsive-modal-content compact">
        <button class="responsive-close-btn" id="name-input-close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
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
    modal.classList.add('show');

    const nameInput = modal.querySelector('#player-name');
    const submitBtn = modal.querySelector('#submit-score-btn');
    const cancelBtn = modal.querySelector('#cancel-score-btn');
    const closeBtn = modal.querySelector('#name-input-close');

    // Focus on input
    setTimeout(() => nameInput.focus(), 100);

    // Event listeners
    const closeModal = () => {
      modal.classList.remove('show');
      setTimeout(() => {
        if (modal.parentNode) {
          document.body.removeChild(modal);
        }
      }, 300);
    };

    submitBtn.addEventListener('click', async () => {
      const playerName = nameInput.value.trim();
      if (playerName) {
        console.log('Name input submit button clicked with playerName:', playerName);
        
        // Check if name already exists
        const nameCheck = await this.checkNameExists(playerName, scoreData.gameMode);
        if (nameCheck.success && nameCheck.exists) {
          // Name already exists, show error
          const errorDiv = document.createElement('div');
          errorDiv.style.cssText = 'color: #dc3545; font-size: 0.9rem; margin-top: 10px; text-align: center;';
          errorDiv.textContent = 'This name is already taken. Please choose a different name.';
          
          // Remove any existing error message
          const existingError = modal.querySelector('.name-error');
          if (existingError) {
            existingError.remove();
          }
          
          errorDiv.className = 'name-error';
          modal.querySelector('.input-group').appendChild(errorDiv);
          nameInput.focus();
          return;
        }
        
        closeModal();
        // Submit the score and call callback with result
        const result = await this.submitScore({
          playerName: playerName,
          ...scoreData
        });
        console.log('Score submission result:', result);
        callback(result);
      } else {
        nameInput.focus();
      }
    });

    cancelBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);

    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Submit on Enter key
    nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        submitBtn.click();
      }
    });
  }

  // Check if a player name already exists in the leaderboard
  async checkNameExists(playerName, gameMode) {
    if (!this.isConnected) {
      console.warn('Supabase not connected, cannot check name existence');
      return { success: false, error: 'Not connected' };
    }

    try {
      let data, error;
      if (gameMode === 'daily_challenge') {
        const result = await this.supabase
          .from('daily_challenge_leaderboard')
          .select('player_name')
          .limit(1000); // Get all names to check case-insensitively
        data = result.data;
        error = result.error;
      } else {
        const result = await this.supabase
          .from('taptile_leaderboard')
          .select('player_name')
          .limit(1000); // Get all names to check case-insensitively
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Error checking name existence:', error);
        return { success: false, error: error.message };
      }

      // Check case-insensitively
      const playerNameLower = playerName.toLowerCase();
      const exists = data && data.some(entry => entry.player_name.toLowerCase() === playerNameLower);
      console.log(`Name "${playerName}" (case-insensitive) exists in ${gameMode}:`, exists);
      return { success: true, exists: exists };
    } catch (err) {
      console.error('Error checking name existence:', err);
      return { success: false, error: err.message };
    }
  }

  // Check if player has already attempted daily challenge today
  async hasDailyAttemptToday(playerName) {
    console.log('🔍 hasDailyAttemptToday called with playerName:', playerName);
    console.log('🔍 Supabase connection status:', this.isConnected);
    
    // Get today's date in UTC to ensure consistent reset time across all timezones
    const today = new Date().toISOString().split('T')[0];
    console.log('🔍 Today\'s date (UTC):', today);
    console.log('🔍 Current local time:', new Date().toString());
    
    const localStorageFlag = localStorage.getItem(`daily_challenge_completed_${today}`);
    console.log('🔍 localStorage flag check for today:', today, 'flag:', localStorageFlag);
    console.log('🔍 All localStorage keys:', Object.keys(localStorage).filter(key => key.includes('daily_challenge')));
    
    if (localStorageFlag === 'true') {
      console.log('🚫 localStorage flag indicates daily challenge already completed today');
      return { success: true, hasAttempted: true, source: 'localStorage' };
    }
    
    if (!this.isConnected) {
      console.warn('Supabase not connected, cannot check daily attempt');
      return { success: false, error: 'Not connected' };
    }

    try {
      console.log('Calling Supabase RPC has_daily_attempt_today with player_name_param:', playerName);
      const { data, error } = await this.supabase
        .rpc('has_daily_attempt_today', {
          player_name_param: playerName
        });

      console.log('Supabase RPC response - data:', data, 'error:', error);

      if (error) {
        console.error('Error checking daily attempt:', error);
        return { success: false, error: error.message };
      }

      // Handle both object response and direct boolean response
      const hasAttempted = typeof data === 'object' ? data.has_attempted : data;
      console.log('Daily attempt check result - hasAttempted:', hasAttempted);
      
      // If backend says they've attempted, also set localStorage flag
      if (hasAttempted) {
        localStorage.setItem(`daily_challenge_completed_${today}`, 'true');
        console.log('Set localStorage flag for today');
      }
      
      return { success: true, hasAttempted: hasAttempted, source: 'database' };
    } catch (err) {
      console.error('Error checking daily attempt:', err);
      return { success: false, error: err.message };
    }
  }

  // Get player's today's daily challenge score if they've already played
  async getTodaysDailyScore(playerName) {
    if (!this.isConnected) {
      console.warn('Supabase not connected, cannot get today\'s score');
      return { success: false, error: 'Not connected' };
    }
    try {
      const today = new Date().toISOString().split('T')[0]; // UTC date
      console.log('🔍 Getting today\'s score for date (UTC):', today);
      const { data, error } = await this.supabase
        .from('daily_challenge_leaderboard')
        .select('*')
        .eq('player_name', playerName)
        .eq('attempt_date', today)
        .order('score', { ascending: false })
        .limit(1);
      if (error) {
        console.error('Error getting today\'s score:', error);
        return { success: false, error: error.message };
      }
      return { success: true, data: data[0] || null };
    } catch (err) {
      console.error('Error getting today\'s score:', err);
      return { success: false, error: err.message };
    }
  }

  // Show daily challenge already attempted modal
  showDailyAlreadyAttemptedModal(todaysScore) {
    const modal = document.createElement('div');
    modal.className = 'responsive-modal';
    modal.innerHTML = `
      <div class="responsive-modal-content standard">
        <button class="responsive-close-btn" id="daily-attempted-close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <h3>Daily Challenge Already Completed!</h3>
        <p>Come back tomorrow to try to beat your daily best!</p>
        ${todaysScore ? `
          <div class="todays-score">
            <p>Today's Score: <strong>${todaysScore.score}</strong> points</p>
            <p>Top Word: "${this.escapeHtml(todaysScore.top_word || 'N/A')}" (${todaysScore.top_word_score || 0} pts)</p>
          </div>
        ` : ''}
        <p>Want to keep playing? Click here to try Fallphabet Taptile and go for your ultimate high score!</p>
        <div class="modal-actions">
          <button id="play-taptile-btn" class="modal-btn primary">Play Fallphabet Taptile</button>
          <button id="view-leaderboard-btn" class="modal-btn">View Daily Leaderboard</button>
          <button id="close-modal-btn" class="modal-btn">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.classList.add('show');

    const playTaptileBtn = modal.querySelector('#play-taptile-btn');
    const viewLeaderboardBtn = modal.querySelector('#view-leaderboard-btn');
    const closeBtn = modal.querySelector('#close-modal-btn');
    const closeModalBtn = modal.querySelector('#close-modal-btn');

    const closeModal = () => {
      modal.classList.remove('show');
      setTimeout(() => {
        if (modal.parentNode) {
          document.body.removeChild(modal);
        }
      }, 300);
    };

    // Event listeners
    playTaptileBtn.addEventListener('click', () => {
      closeModal();
      // Switch to Taptile mode
      if (window.switchToTaptileMode) {
        window.switchToTaptileMode();
      } else {
        // Fallback: manually switch mode
        if (window.gameModeManager) {
          window.gameModeManager.setMode('taptile');
          setTimeout(() => {
            window.gameModeManager.updateUI();
            
            // Create game if it doesn't exist (in case it was blocked by daily challenge check)
            if (!window.game) {
              console.log('Creating game for Taptile mode (fallback - was previously blocked)');
              try {
                window.game = new Phaser.Game(config);
                console.log('Phaser game created successfully for Taptile mode (fallback)');
              } catch (error) {
                console.error('Error creating game for Taptile mode (fallback):', error);
              }
            } else if (window.game.scene && window.game.scene.keys && window.game.scene.keys['GameScene']) {
              // Game exists, restart with new mode
              console.log('Restarting existing game for Taptile mode (fallback)');
              window.game.scene.stop('GameScene');
              window.game.scene.remove('GameScene');
              window.game.scene.add('GameScene', GameScene, true);
            }
          }, 100);
        }
      }
    });

    viewLeaderboardBtn.addEventListener('click', () => {
      closeModal();
      // Show dedicated daily leaderboard view instead of slide-up modal
      this.showDailyLeaderboardView();
    });

    closeBtn.addEventListener('click', closeModal);
    closeModalBtn.addEventListener('click', closeModal);

    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  // Show dedicated daily leaderboard view
  showDailyLeaderboardView() {
    const modal = document.createElement('div');
    modal.className = 'responsive-modal';
    modal.innerHTML = `
      <div class="responsive-modal-content large">
        <button class="responsive-close-btn" id="close-daily-leaderboard-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <h3>Today's Daily Challenge Leaderboard</h3>
        <div id="daily-leaderboard-list" class="leaderboard-list">
          <div class="loading">Loading today's leaderboard...</div>
        </div>
        <div class="modal-actions">
          <button id="play-taptile-from-leaderboard-btn" class="modal-btn primary">Play Fallphabet Taptile</button>
          <button id="close-daily-leaderboard-modal-btn" class="modal-btn">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.classList.add('show');

    const closeBtn = modal.querySelector('#close-daily-leaderboard-btn');
    const closeModalBtn = modal.querySelector('#close-daily-leaderboard-modal-btn');
    const playTaptileBtn = modal.querySelector('#play-taptile-from-leaderboard-btn');

    // Load and render daily leaderboard
    this.renderDailyLeaderboard(modal.querySelector('#daily-leaderboard-list'));

    const closeModal = () => {
      modal.classList.remove('show');
      setTimeout(() => {
        if (modal.parentNode) {
          document.body.removeChild(modal);
        }
      }, 300);
    };

    // Event listeners
    closeBtn.addEventListener('click', closeModal);
    closeModalBtn.addEventListener('click', closeModal);

    playTaptileBtn.addEventListener('click', () => {
      closeModal();
      // Switch to Taptile mode
      if (window.gameModeManager) {
        window.gameModeManager.setMode('taptile');
        setTimeout(() => {
          window.gameModeManager.updateUI();
          // Restart game with new mode
          if (window.game && window.game.scene && window.game.scene.keys && window.game.scene.keys['GameScene']) {
            window.game.scene.stop('GameScene');
            window.game.scene.remove('GameScene');
            window.game.scene.add('GameScene', GameScene, true);
          }
        }, 100);
      }
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  // Show dedicated Taptile leaderboard view
  async showTaptileLeaderboardView() {
    const modal = document.createElement('div');
    modal.className = 'responsive-modal';
    modal.innerHTML = `
      <div class="responsive-modal-content large">
        <button class="responsive-close-btn" id="close-taptile-leaderboard-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <h3>Global Taptile Leaderboard</h3>
        <div id="taptile-leaderboard-list" class="leaderboard-list">
          <div class="loading">Loading Taptile leaderboard...</div>
        </div>
        <div class="modal-actions">
          <button id="play-daily-from-leaderboard-btn" class="modal-btn primary">Play Daily Challenge</button>
          <button id="try-again-taptile-btn" class="modal-btn primary" style="display:none;">Try Again</button>
          <button id="close-taptile-leaderboard-modal-btn" class="modal-btn">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.classList.add('show');

    const closeBtn = modal.querySelector('#close-taptile-leaderboard-btn');
    const closeModalBtn = modal.querySelector('#close-taptile-leaderboard-modal-btn');
    const playDailyBtn = modal.querySelector('#play-daily-from-leaderboard-btn');
    const tryAgainBtn = modal.querySelector('#try-again-taptile-btn');

    // Load and render Taptile leaderboard
    this.renderTaptileLeaderboard(modal.querySelector('#taptile-leaderboard-list'));

    // Hide or show Play Daily/ Try Again based on daily attempt
    const playerIdentifier = this.getPlayerIdentifier();
    this.hasDailyAttemptToday(playerIdentifier).then(result => {
      if (result.success && result.hasAttempted) {
        // Already played daily: hide Play Daily, show Try Again
        playDailyBtn.style.display = 'none';
        tryAgainBtn.style.display = '';
      } else {
        // Not played daily: show Play Daily, hide Try Again
        playDailyBtn.style.display = '';
        tryAgainBtn.style.display = 'none';
      }
    });

    const closeModal = () => {
      modal.classList.remove('show');
      setTimeout(() => {
        if (modal.parentNode) {
          document.body.removeChild(modal);
        }
      }, 300);
    };

    // Event listeners
    closeBtn.addEventListener('click', closeModal);
    closeModalBtn.addEventListener('click', closeModal);

    playDailyBtn.addEventListener('click', () => {
      closeModal();
      // Switch to Daily Challenge mode
      if (window.gameModeManager) {
        window.gameModeManager.setMode('daily');
        setTimeout(() => {
          window.gameModeManager.updateUI();
          // Restart game with new mode
          if (window.game && window.game.scene && window.game.scene.keys && window.game.scene.keys['GameScene']) {
            window.game.scene.stop('GameScene');
            window.game.scene.remove('GameScene');
            window.game.scene.add('GameScene', GameScene, true);
          }
        }, 100);
      }
    });

    tryAgainBtn.addEventListener('click', () => {
      closeModal();
      // Restart Taptile mode
      if (window.gameModeManager) {
        window.gameModeManager.setMode('taptile');
        setTimeout(() => {
          window.gameModeManager.updateUI();
          if (window.game && window.game.scene && window.game.scene.keys && window.game.scene.keys['GameScene']) {
            window.game.scene.stop('GameScene');
            window.game.scene.remove('GameScene');
            window.game.scene.add('GameScene', GameScene, true);
          }
        }, 100);
      }
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  // Render daily leaderboard specifically for today
  async renderDailyLeaderboard(container) {
    console.log('renderDailyLeaderboard called');
    if (!this.isConnected) {
      console.log('Not connected to Supabase');
      container.innerHTML = '<div class="error">Unable to load leaderboard - not connected to server</div>';
      return;
    }
    try {
      const today = new Date().toISOString().split('T')[0];
      console.log('Fetching daily leaderboard for date:', today);
      const { data, error } = await this.supabase
        .from('daily_challenge_leaderboard')
        .select('*')
        .eq('attempt_date', today)
        .order('score', { ascending: false })
        .limit(20);
      console.log('Daily leaderboard query result - data:', data, 'error:', error);
      if (error) {
        console.error('Error loading daily leaderboard:', error);
        container.innerHTML = '<div class="error">Error loading leaderboard</div>';
        return;
      }
      if (!data || data.length === 0) {
        console.log('No scores found for today');
        container.innerHTML = '<div class="no-scores">No scores yet today! Be the first to play!</div>';
        return;
      }
      const playerIdentifier = this.getPlayerIdentifier();
      let html = '<div class="leaderboard-entries">';
      data.forEach((entry, index) => {
        const isCurrentPlayer = entry.player_name === playerIdentifier;
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
        html += `
          <div class="leaderboard-entry ${isCurrentPlayer ? 'current-player' : ''}">
            <div class="rank">${medal} ${rank}</div>
            <div class="player-name">${this.escapeHtml(entry.player_name)}</div>
            <div class="score">${entry.score.toLocaleString()}</div>
            <div class="details">
              <span class="words">${entry.words_used} words</span>
              ${entry.top_word ? `<span class="top-word">"${this.escapeHtml(entry.top_word)}" (${entry.top_word_score} pts)</span>` : ''}
            </div>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    } catch (err) {
      console.error('Error rendering daily leaderboard:', err);
      container.innerHTML = '<div class="error">Error loading leaderboard</div>';
    }
  }

  // --- Robust Taptile High Score Sync ---
  // Call this after fetching leaderboard data
  updateTaptileHighScoreFromLeaderboard(playerName, leaderboardData) {
    if (!playerName || !leaderboardData) return;
    // Find the highest score for this player
    let best = 0;
    leaderboardData.forEach(entry => {
      if (entry.player_name === playerName && entry.score > best) {
        best = entry.score;
      }
    });
    const highScoreKey = `taptile_high_score_${playerName}`;
    localStorage.setItem(highScoreKey, best.toString());
  }

  // Get the best Taptile score for the current player from leaderboard (if available) or localStorage
  getBestTaptileScore(playerName, leaderboardData) {
    let best = 0;
    if (leaderboardData) {
      leaderboardData.forEach(entry => {
        if (entry.player_name === playerName && entry.score > best) {
          best = entry.score;
        }
      });
    }
    const highScoreKey = `taptile_high_score_${playerName}`;
    const localBest = parseInt(localStorage.getItem(highScoreKey) || '0');
    return Math.max(best, localBest);
  }

  // Render Taptile leaderboard
  async renderTaptileLeaderboard(container) {
    if (!this.isConnected) {
      container.innerHTML = '<div class="error">Unable to load leaderboard - not connected to server</div>';
      return;
    }
    try {
      const limit = 50; // Get more data to filter properly
      const { data, error } = await this.supabase
        .from('taptile_leaderboard')
        .select('*')
        .order('score', { ascending: false })
        .limit(limit);
      if (error) {
        console.error('Error loading Taptile leaderboard:', error);
        container.innerHTML = '<div class="error">Error loading leaderboard</div>';
        return;
      }
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="no-scores">No scores yet! Be the first to play!</div>';
        return;
      }
      // --- Sync high score to localStorage ---
      const playerIdentifier = this.getPlayerIdentifier();
      this.updateTaptileHighScoreFromLeaderboard(playerIdentifier, data);
      // Filter to show only the best score per user
      const userBestScores = new Map();
      data.forEach(entry => {
        const existing = userBestScores.get(entry.player_name);
        if (!existing || entry.score > existing.score) {
          userBestScores.set(entry.player_name, entry);
        }
      });
      // Convert back to array and sort by score
      const filteredData = Array.from(userBestScores.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 20); // Show top 20 users
      let html = '<div class="leaderboard-entries">';
      filteredData.forEach((entry, index) => {
        const isCurrentPlayer = entry.player_name === playerIdentifier;
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
        html += `
          <div class="leaderboard-entry ${isCurrentPlayer ? 'current-player' : ''}">
            <div class="rank">${medal} ${rank}</div>
            <div class="player-name">${this.escapeHtml(entry.player_name)}</div>
            <div class="score">${entry.score.toLocaleString()}</div>
            <div class="details">
              <span class="speed">${entry.max_chain_multiplier ? entry.max_chain_multiplier.toFixed(1) + 'x' : '1.0x'}</span>
              <span class="time">${entry.game_duration_seconds ? entry.game_duration_seconds.toFixed(1) + 's' : '0s'}</span>
              <span class="words">${entry.words_used || 0} words</span>
            </div>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    } catch (err) {
      console.error('Error rendering Taptile leaderboard:', err);
      container.innerHTML = '<div class="error">Error loading leaderboard</div>';
    }
  }

  // --- Patch high score check to use leaderboard value ---
  checkTaptileHighScore(currentScore) {
    const playerIdentifier = this.getPlayerIdentifier();
    // Try to get leaderboard data from localStorage (synced after leaderboard fetch)
    const best = this.getBestTaptileScore(playerIdentifier);
    return currentScore > best;
  }
}

// Initialize global leaderboard manager
window.globalLeaderboard = new GlobalLeaderboardManager(); 