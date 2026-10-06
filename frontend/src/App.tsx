import { Route, Routes, useLocation } from 'react-router-dom'
import { CategoryStub } from './pages/stubs'
import { DesignSystemShowcase } from './pages/DesignSystemShowcase'
import { DesignIngressosShowcase } from './pages/DesignIngressosShowcase'
import { Header } from './components/layout/Header'
import { Home } from './pages/Home'
import { Search } from './pages/Search'
import { Product } from './pages/Product'
import { Cart } from './pages/Cart'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Checkout } from './pages/Checkout'
import { OrderReceived } from './pages/OrderReceived'
import { Orders } from './pages/Orders'
import { OrderDetail } from './pages/OrderDetail'
import { PixPayment } from './pages/PixPayment'
import { CheckoutSuccess } from './pages/CheckoutSuccess'
import { EventPage } from './pages/EventPage'
import { EventSessionPage } from './pages/EventSessionPage'
import { SignupPage } from './pages/SignupPage'
import { LoginPage } from './pages/LoginPage'
import { SearchPage } from './pages/SearchPage'
import { TicketsPage } from './pages/TicketsPage'
import { TicketOrderDetailPage } from './pages/TicketOrderDetailPage'
import { SellersVerifySoonPage } from './pages/SellersVerifySoonPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { TermsPage, PrivacyPage } from './pages/TicketStaticPages'
import { TicketNotFoundPage as TicketNotFound } from './pages/TicketStaticPages'
import { TicketShell } from './components/ingressos/TicketShell'

// Rotas com shell próprio (ingressos + showcase) — o Header do marketplace fica fora
function usesTicketShell(pathname: string): boolean {
  return (
    pathname.startsWith('/design-ingressos') ||
    pathname.startsWith('/event') ||
    pathname === '/search' ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/tickets') ||
    pathname.startsWith('/sellers') ||
    pathname === '/terms' ||
    pathname === '/privacy'
  )
}

function HeaderGate() {
  const { pathname } = useLocation()
  return usesTicketShell(pathname) ? null : <Header />
}

export function App() {
  return (
    <>
      <HeaderGate />
      <Routes>
        {/* ── Marketplace (fluxo legado de produtos físicos) ── */}
        <Route path="/" element={<Home />} />
        <Route path="/design" element={<DesignSystemShowcase />} />
        <Route path="/design-ingressos" element={<DesignIngressosShowcase />} />
        <Route path="/search-legacy" element={<Search />} />
        <Route path="/c/:slug" element={<CategoryStub />} />
        <Route path="/product/:slug" element={<Product />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/login-legacy" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/checkout-legacy" element={<Checkout />} />
        <Route path="/checkout/pedido-recebido/:code" element={<OrderReceived />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:code" element={<OrderDetail />} />



        {/* ── Tema ingressos (shell próprio: faixa legal + TopBar 56px + rodapé) ── */}
        <Route element={<TicketShell />}>
          <Route path="/event/:slug" element={<EventPage />} />
          <Route path="/event/:slug/session/:id" element={<EventSessionPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/:code" element={<TicketOrderDetailPage />} />
          <Route path="/sellers/verify" element={<SellersVerifySoonPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/payments/:id" element={<PixPayment />} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<TicketNotFound />} />
        </Route>
      </Routes>
    </>
  )
}

