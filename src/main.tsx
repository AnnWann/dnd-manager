import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './mobileDialogs.css'
import App from './App.tsx'
import { I18nProvider } from './i18n/I18nContext'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <I18nProvider locale="pt-BR">
        <App />
      </I18nProvider>
    ),
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
