import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { SessionProvider } from '@/app/session'
import App from '@/app/App'
import '@/index.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } })
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><SessionProvider><BrowserRouter><App /></BrowserRouter></SessionProvider></QueryClientProvider></React.StrictMode>)
