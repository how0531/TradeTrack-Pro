
// [Manage] Last Updated: 2024-05-22
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TradeProvider } from './context/TradeContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <TradeProvider>
          <App />
        </TradeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
