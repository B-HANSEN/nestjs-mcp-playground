const form = document.querySelector('#chat-form');
const input = document.querySelector('#message-input');
const messages = document.querySelector('#messages');
const providerStatus = document.querySelector('#provider-status');
const chatHistory = [];

async function loadProviderStatus() {
  if (!providerStatus) {
    return;
  }

  try {
    const response = await fetch('/api/chat/status');
    const status = await response.json();
    providerStatus.textContent = `Provider: ${status.provider}${status.model ? ` (${status.model})` : ''}`;
  } catch {
    providerStatus.textContent = 'Provider: unavailable';
  }
}

function appendMessage(role, content, airports = [], hotelRecommendations = []) {
  const article = document.createElement('article');
  article.className = `message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = content;

  if (airports.length > 0) {
    bubble.appendChild(renderAirports(airports));
  }

  if (hotelRecommendations.length > 0) {
    bubble.appendChild(renderHotelRecommendations(hotelRecommendations));
  }

  article.appendChild(bubble);
  messages.appendChild(article);
  messages.scrollTop = messages.scrollHeight;
}

function renderAirports(airports) {
  const list = document.createElement('div');
  list.className = 'airport-list';

  airports.forEach((airport) => {
    const item = document.createElement('div');
    item.className = 'airport-item';

    const code = document.createElement('div');
    code.className = 'airport-code';
    code.textContent = airport.code || 'AIR';

    const details = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'airport-name';
    name.textContent = airport.name || 'Airport';

    const meta = document.createElement('div');
    meta.className = 'airport-meta';
    meta.textContent = [airport.city, airport.country, airport.distanceLabel].filter(Boolean).join(' - ');

    details.append(name, meta);
    item.append(code, details);
    list.appendChild(item);
  });

  return list;
}

function renderHotelRecommendations(recommendations) {
  const list = document.createElement('div');
  list.className = 'hotel-list';

  recommendations.forEach((recommendation) => {
    const item = document.createElement('div');
    item.className = 'hotel-item';

    const title = document.createElement('div');
    title.className = 'hotel-title';
    title.textContent = 'Hotel search prepared';

    const meta = document.createElement('div');
    meta.className = 'hotel-meta';
    const filters = recommendation.appliedFilters || {};
    const attributes = Array.isArray(filters.hotelAttributes) ? filters.hotelAttributes.join(', ') : 'selected filters';
    meta.textContent = `Filters: ${attributes}`;

    const link = document.createElement('a');
    link.className = 'hotel-link';
    link.href = recommendation.searchUrl;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'View hotel search';

    item.append(title, meta, link);

    if (recommendation.limitations?.length) {
      const limitations = document.createElement('ul');
      limitations.className = 'hotel-limitations';

      recommendation.limitations.forEach((limitation) => {
        const entry = document.createElement('li');
        entry.textContent = limitation;
        limitations.appendChild(entry);
      });

      item.appendChild(limitations);
    }

    list.appendChild(item);
  });

  return list;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const message = input.value.trim();
  if (!message) {
    return;
  }

  appendMessage('user', message);
  chatHistory.push({ role: 'user', content: message });
  input.value = '';
  form.querySelector('button').disabled = true;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: chatHistory }),
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    const data = await response.json();
    appendMessage('assistant', data.reply, data.airports || [], data.hotelRecommendations || []);
    chatHistory.push({ role: 'assistant', content: data.reply });
  } catch {
    appendMessage('assistant', 'I could not reach the travel assistant. Please try again.');
  } finally {
    form.querySelector('button').disabled = false;
    input.focus();
  }
});

void loadProviderStatus();
