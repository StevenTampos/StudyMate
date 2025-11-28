// Theme management for all pages
function initializeTheme() {
    // Load saved theme or default to light
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
    
    // Set up theme toggle if it exists on the page
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.checked = savedTheme === 'dark';
        themeToggle.addEventListener('change', toggleTheme);
    }
}

function applyTheme(theme) {
    // Update the theme on the root element
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update all theme toggles on the page
    const themeToggles = document.querySelectorAll('#themeToggle');
    themeToggles.forEach(toggle => {
        toggle.checked = theme === 'dark';
    });
    
    // Update the theme label if it exists
    const themeLabels = document.querySelectorAll('#themeLabel');
    themeLabels.forEach(label => {
        label.textContent = theme === 'dark' ? 'Dark' : 'Light';
    });
    
    // Save the theme preference
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
}

// Initialize theme when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeTheme);

// Make the function available globally
window.toggleTheme = toggleTheme;
const currentTheme = localStorage.getItem('theme') || 
                    (prefersDarkScheme.matches ? 'dark' : 'light');

// Apply the saved theme
applyTheme(currentTheme);
if (themeToggle) {
    themeToggle.checked = currentTheme === 'dark';
}

// Toggle theme function
function toggleTheme() {
    const newTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
    
    // Update theme toggle state
    if (themeToggle) {
        themeToggle.checked = newTheme === 'dark';
    }
}

// Add event listener to theme toggle
if (themeToggle) {
    themeToggle.addEventListener('change', toggleTheme);
}

// Export the toggle function for other scripts to use if needed
window.toggleTheme = toggleTheme;
