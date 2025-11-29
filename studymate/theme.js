// theme.js - StudyMate Theme Management

(function() {
    'use strict';
    
    const THEME_KEY = 'studymate_theme_v1';
    
    // 1. Initialize theme immediately to prevent flash
    function initializeTheme() {
        const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
        applyTheme(savedTheme, false);
    }
    
    // 2. Apply theme to the page
    function applyTheme(theme, save = true) {
        // Set the data-theme attribute on the root element
        document.documentElement.setAttribute('data-theme', theme);
        
        // Save theme preference
        if (save) {
            localStorage.setItem(THEME_KEY, theme);
        }
        
        // CRITICAL FIX: Only set .checked state if the element exists
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.checked = theme === 'dark';
        }
    }
    
    // 3. Toggle between light and dark theme
    function toggleTheme() {
        const currentTheme = localStorage.getItem(THEME_KEY) || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        applyTheme(newTheme, true);
    }
    
    // --- Execution ---
    
    // Run initialization immediately on load
    initializeTheme();
    
    // Wait for the DOM to be fully loaded before attaching listeners
    document.addEventListener('DOMContentLoaded', function() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            // Attach listener ONLY if the element is found
            themeToggle.addEventListener('change', function() {
                const newTheme = this.checked ? 'dark' : 'light';
                applyTheme(newTheme, true);
            });
        }
    });
    
    // Export functions globally
    window.applyTheme = applyTheme;
    window.toggleTheme = toggleTheme;
})();