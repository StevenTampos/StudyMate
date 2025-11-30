// theme.js - StudyMate Theme Management
//

(function() {
    'use strict';
    
    const THEME_KEY = 'studymate_theme_v1';
    const TOKEN_KEY = 'studymate_auth_token'; // Must match app.js
    const API_URL = 'auth.php?action=profile';
    const NO_TRANSITION_CLASS = 'no-transition';
    
    // --- Database Helpers ---

    async function getThemeFromDatabase() {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return null;

        try {
            // Added timestamp to URL (?t=...) to prevent browser caching
            const response = await fetch(`${API_URL}&t=${new Date().getTime()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });

            if (response.ok) {
                const data = await response.json();
                // Validate that the theme is valid
                if (data.theme_preference === 'light' || data.theme_preference === 'dark') {
                    return data.theme_preference;
                }
            }
        } catch (error) {
            console.warn('Background theme sync failed:', error);
        }
        return null;
    }

    async function saveThemeToDatabase(theme) {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return;

        try {
            await fetch(API_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ theme_preference: theme })
            });
            console.log('Theme saved to remote DB:', theme);
        } catch (error) {
            console.error('Failed to save theme to DB:', error);
        }
    }

    // --- Core Theme Logic ---

    // 1. Apply theme to DOM and handle storage
    function applyTheme(theme, saveToLocal = true, saveToRemote = true) {
        // Update DOM
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update Switch UI (if present)
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.checked = (theme === 'dark');
            const themeLabel = document.getElementById('themeLabel');
            if (themeLabel) themeLabel.textContent = theme === 'dark' ? 'Dark' : 'Light';
        }
        
        // Save to LocalStorage (Instant recall for next reload)
        if (saveToLocal) {
            localStorage.setItem(THEME_KEY, theme);
        }
        
        // Save to Database (Persist across devices)
        if (saveToRemote) {
            saveThemeToDatabase(theme);
        }
    }

    // 2. Initialize: Load Local -> Then Sync Remote
    async function initializeTheme() {
        // Prevent transition flash
        document.documentElement.classList.add(NO_TRANSITION_CLASS);
        
        // A. Immediate: Load from LocalStorage (Fastest)
        const localTheme = localStorage.getItem(THEME_KEY) || 'light';
        // Apply locally, DO NOT save to DB yet (it would be redundant)
        applyTheme(localTheme, false, false); 
        
        // Restore transitions
        window.requestAnimationFrame(() => {
            document.documentElement.classList.remove(NO_TRANSITION_CLASS);
        });

        // B. Background: Sync from Database (Solves the PC/Phone bug)
        const remoteTheme = await getThemeFromDatabase();
        
        // If remote theme exists and is different from local, update everything
        if (remoteTheme && remoteTheme !== localTheme) {
            console.log(`Syncing theme: Local(${localTheme}) -> Remote(${remoteTheme})`);
            // Update LocalStorage, but DO NOT save back to DB (it just came from there)
            applyTheme(remoteTheme, true, false); 
        }
    }
    
    // 3. User Action: Toggle Theme
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        // User changed it manually: Save to BOTH Local and Remote
        applyTheme(newTheme, true, true); 
    }

    // --- Event Listeners ---
    
    // Run initialization
    initializeTheme();
    
    document.addEventListener('DOMContentLoaded', function() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.removeEventListener('change', handleToggleChange);
            themeToggle.addEventListener('change', handleToggleChange);
        }
    });

    function handleToggleChange(e) {
        const newTheme = e.target.checked ? 'dark' : 'light';
        applyTheme(newTheme, true, true);
    }
    
    // Export globally (Compatible with app.js calls)
    window.applyTheme = function(theme, save = true) {
        // If app.js calls this, we assume they want to save to LocalStorage
        // We assume save=true means "User action", so we save to DB too.
        // However, since we handle sync internally now, app.js calls are mostly redundant.
        applyTheme(theme, save, save);
    };
    window.toggleTheme = toggleTheme;
})();