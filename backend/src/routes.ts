import { Router, type NextFunction, type Request, type Response } from 'express'
import { getCategories, getHealth, getProduct, listProducts } from './controllers/catalog.controller'
import { addCartItem, getCart, removeCartItem, updateCartItem } from './controllers/cart.controller'
import { login, logout, me, register } from './controllers/auth.controller'
import { createAddress, deleteAddress, listAddresses } from './controllers/address.controller'
import { getShippingOptions } from './controllers/shipping.controller'
import { cancelOrder, createOrder, getOrder, listOrders } from './controllers/order.controller'

// Express 4 não captura rejeições de handlers async — wrapper obrigatório
const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next)
  }

export const router = Router()

router.get('/health', getHealth)
router.get('/products', asyncHandler(listProducts))
router.get('/products/:slug', asyncHandler(getProduct))
router.get('/categories', getCategories)
router.get('/cart', asyncHandler(getCart))
router.post('/cart/items', asyncHandler(addCartItem))
router.patch('/cart/items/:itemId', asyncHandler(updateCartItem))
router.delete('/cart/items/:itemId', asyncHandler(removeCartItem))
router.post('/auth/register', asyncHandler(register))
router.post('/auth/login', asyncHandler(login))
router.post('/auth/logout', asyncHandler(logout))
router.get('/auth/me', asyncHandler(me))
router.get('/addresses', asyncHandler(listAddresses))
router.post('/addresses', asyncHandler(createAddress))
router.delete('/addresses/:id', asyncHandler(deleteAddress))
router.get('/shipping/options', asyncHandler(getShippingOptions))
router.get('/orders', asyncHandler(listOrders))
router.post('/orders', asyncHandler(createOrder))
router.get('/orders/:code', asyncHandler(getOrder))
router.post('/orders/:code/cancel', asyncHandler(cancelOrder))
