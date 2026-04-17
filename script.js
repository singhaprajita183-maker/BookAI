/**
 * BookAI – script.js
 *
 * Features:
 *  1. Text search using Google Books API
 *  2. Voice search using the Web Speech API (SpeechRecognition)
 */

"use strict";

// ─── DOM References ────────────────────────────────────────────────────────────
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const voiceBtn = document.getElementById("voiceBtn");
const voiceStatus = document.getElementById("voiceStatus");
const resultsSection = document.getElementById("resultsSection");

// ─── Google Books API ──────────────────────────────────────────────────────────
const BOOKS_API_BASE = "https://www.googleapis.com/books/v1/volumes";
const MAX_RESULTS = 12;

/**
 * Fetch books from the Google Books API.
 * @param {string} query - Search query string
 * @returns {Promise<Array>} Array of volume objects
 */
async function fetchBooks(query) {
  const url = new URL(BOOKS_API_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", MAX_RESULTS);
  url.searchParams.set("printType", "books");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Google Books API error: ${response.status}`);
  }
  const data = await response.json();
  return data.items || [];
}

// ─── Rendering ─────────────────────────────────────────────────────────────────

/** Show a loading spinner while fetching. */
function showLoading() {
  resultsSection.innerHTML = `
    <div class="loading-wrapper" role="status" aria-label="Loading results">
      <div class="spinner"></div>
      <p>Searching…</p>
    </div>`;
}

/** Show an error message. */
function showError(message) {
  resultsSection.innerHTML = `<p class="message message--error">⚠️ ${message}</p>`;
}

/** Show an info / no-results message. */
function showInfo(message) {
  resultsSection.innerHTML = `<p class="message message--info">ℹ️ ${message}</p>`;
}

/**
 * Build and display book cards for the given volumes array.
 * @param {Array} books - Google Books API volume items
 */
function renderBooks(books) {
  if (!books.length) {
    showInfo("No books found. Try a different search term.");
    return;
  }

  const grid = document.createElement("div");
  grid.className = "results-grid";

  books.forEach((book) => {
    const info = book.volumeInfo || {};
    const title = info.title || "Unknown Title";
    const authors = info.authors ? info.authors.join(", ") : "Unknown Author";
    const description = info.description || "";
    const thumbnail =
      (info.imageLinks && info.imageLinks.thumbnail) || null;
    const rawBookUrl = info.infoLink || "";
    // Only allow safe http/https URLs to prevent javascript: injection
    const bookUrl =
      /^https?:\/\//i.test(rawBookUrl) ? rawBookUrl : "#";

    const card = document.createElement("article");
    card.className = "book-card";
    card.innerHTML = `
      <div class="book-cover-wrapper">
        ${
          thumbnail
            ? `<img class="book-cover" src="${escapeHtml(thumbnail)}" alt="Cover of ${escapeHtml(title)}" loading="lazy" />`
            : `<span class="book-cover-placeholder" aria-hidden="true">📖</span>`
        }
      </div>
      <div class="book-info">
        <h2 class="book-title" title="${escapeHtml(title)}">${escapeHtml(title)}</h2>
        <p class="book-author">${escapeHtml(authors)}</p>
        ${description ? `<p class="book-description">${escapeHtml(description)}</p>` : ""}
        <a class="book-link" href="${escapeHtml(bookUrl)}" target="_blank" rel="noopener noreferrer">
          View on Google Books ↗
        </a>
      </div>`;

    grid.appendChild(card);
  });

  resultsSection.innerHTML = "";
  resultsSection.appendChild(grid);
}

/** Minimal HTML escaping to prevent XSS. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Search Handler ────────────────────────────────────────────────────────────

/**
 * Trigger a book search for the current input value.
 */
async function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    showInfo("Please enter a search term.");
    return;
  }

  showLoading();
  try {
    const books = await fetchBooks(query);
    renderBooks(books);
  } catch (err) {
    showError("Failed to fetch books. Please check your connection and try again.");
    console.error(err);
  }
}

// Keyboard: press Enter in the input field to search
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSearch();
});

// Click the Search button
searchBtn.addEventListener("click", handleSearch);

// ─── Voice Search ──────────────────────────────────────────────────────────────

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  // Browser doesn't support the Web Speech API
  voiceBtn.disabled = true;
  voiceBtn.title = "Voice Search is not supported in this browser";
  voiceStatus.textContent =
    "⚠️ Voice Search is not supported in your browser. Try Chrome or Edge.";
} else {
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let isListening = false;

  /** Start voice recognition. */
  function startListening() {
    isListening = true;
    voiceBtn.classList.add("listening");
    voiceBtn.setAttribute("aria-label", "Stop voice search");
    voiceStatus.textContent = "🎙️ Listening… speak now";
    recognition.start();
  }

  /** Stop voice recognition manually. */
  function stopListening() {
    isListening = false;
    recognition.stop();
    voiceBtn.classList.remove("listening");
    voiceBtn.setAttribute("aria-label", "Start voice search");
    voiceStatus.textContent = "";
  }

  voiceBtn.addEventListener("click", () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  });

  recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript;
    searchInput.value = transcript;
    voiceStatus.textContent = `🔎 Searching for: "${transcript}"`;
    handleSearch();
  });

  recognition.addEventListener("end", () => {
    isListening = false;
    voiceBtn.classList.remove("listening");
    voiceBtn.setAttribute("aria-label", "Start voice search");
    // Keep any status message set by the result handler
  });

  recognition.addEventListener("error", (event) => {
    isListening = false;
    voiceBtn.classList.remove("listening");
    voiceBtn.setAttribute("aria-label", "Start voice search");

    const errorMessages = {
      "no-speech": "No speech detected. Please try again.",
      "audio-capture": "Microphone not found. Check your device settings.",
      "not-allowed": "Microphone access denied. Please allow microphone access.",
      "network": "Network error during voice recognition.",
    };
    voiceStatus.textContent =
      "⚠️ " + (errorMessages[event.error] || `Error: ${event.error}`);
  });
}
