// Theme management for all pages - StudyMate
// This file should be included in all HTML pages

(function() {
    'use strict';
    
    const THEME_KEY = 'studymate_theme_v1';
    
    // Initialize theme immediately to prevent flash
    function initializeTheme() {
        const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
        applyTheme(savedTheme, false);
    }
    
    // Apply theme to the page
    function applyTheme(theme, save = true) {
        // Set the data-theme attribute on the root element
        document.documentElement.setAttribute('data-theme', theme);
        
        // Save theme preference if needed
        if (save) {
            localStorage.setItem(THEME_KEY, theme);
        }
        
        // Update theme toggle if it exists
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.checked = theme === 'dark';
        }
    }
    
    // Toggle between light and dark theme
    function toggleTheme() {
        const currentTheme = localStorage.getItem(THEME_KEY) || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        applyTheme(newTheme, true);
    }
    
    // Initialize theme as soon as possible
    initializeTheme();
    
    // Set up event listeners when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
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