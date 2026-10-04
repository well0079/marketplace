import { Route, Routes } from 'react-router-dom'
import { CategoryStub, OrdersStub } from './pages/stubs'
import { NotFound } from './pages/NotFound'
import { DesignSystemShowcase } from './pages/DesignSystemShowcase'
import { Header } from './components/layout/Header'
import { Home } from './pages/Home'
import { Search } from './pages/Search'
import { Product } from './pages/Product'
import { Cart } from './pages/Cart'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Checkout } from './pages/Checkout'

export function App() {
  return (
    <>
      <Header />
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/design" element={<DesignSystemShowcase />} />
      <Route path="/search" element={<Search />} />
      <Route path="/c/:slug" element={<CategoryStub />} />
      <Route path="/product/:slug" element={<Product />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/orders" element={<OrdersStub />} />
      <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}
