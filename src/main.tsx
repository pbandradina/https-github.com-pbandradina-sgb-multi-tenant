import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Elemento raiz '#root' não encontrado: a aplicação não pode ser montada.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
