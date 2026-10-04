import type { Request, Response } from 'express'
import { ApiError } from '../lib/errors'
import { getSessionUser, type PublicUser } from '../lib/auth'
import { prisma } from '../lib/prisma'

const STATES = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
])

async function requireUser(req: Request): Promise<PublicUser> {
  const user = await getSessionUser(req)
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Não autenticado')
  return user
}

function readString(body: unknown, key: string): string {
  const value = (body as Record<string, unknown> | undefined)?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

export async function listAddresses(req: Request, res: Response) {
  const user = await requireUser(req)
  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  })
  res.json(addresses)
}

export async function createAddress(req: Request, res: Response) {
  const user = await requireUser(req)
  const input = {
    label: readString(req.body, 'label'),
    recipient: readString(req.body, 'recipient'),
    zipCode: readString(req.body, 'zipCode').replace(/\D/g, ''),
    street: readString(req.body, 'street'),
    number: readString(req.body, 'number'),
    complement: readString(req.body, 'complement'),
    district: readString(req.body, 'district'),
    city: readString(req.body, 'city'),
    state: readString(req.body, 'state').toUpperCase(),
  }

  const fields: Record<string, string> = {}
  if (input.recipient.length < 2) fields.recipient = 'Informe o nome de quem vai receber.'
  if (input.zipCode.length !== 8) fields.zipCode = 'Informe um CEP válido com 8 dígitos.'
  if (input.street.length < 2) fields.street = 'Informe a rua.'
  if (input.number.length < 1) fields.number = 'Informe o número.'
  if (input.district.length < 2) fields.district = 'Informe o bairro.'
  if (input.city.length < 2) fields.city = 'Informe a cidade.'
  if (!STATES.has(input.state)) fields.state = 'Selecione um estado válido.'
  if (input.label.length > 40) fields.label = 'A identificação deve ter no máximo 40 caracteres.'
  if (input.complement.length > 80) fields.complement = 'O complemento deve ter no máximo 80 caracteres.'
  if (Object.keys(fields).length > 0) {
    throw new ApiError(400, 'VALIDATION', 'Verifique os campos do endereço.', fields)
  }

  // Primeiro endereço do usuário nasce como padrão; padrão explícito desativa os demais
  const hasAddresses = (await prisma.address.count({ where: { userId: user.id } })) > 0
  const isDefault = req.body?.isDefault === true || !hasAddresses
  if (isDefault) {
    await prisma.address.updateMany({ where: { userId: user.id, isDefault: true }, data: { isDefault: false } })
  }

  const address = await prisma.address.create({
    data: {
      userId: user.id,
      label: input.label || null,
      recipient: input.recipient,
      zipCode: input.zipCode,
      street: input.street,
      number: input.number,
      complement: input.complement || null,
      district: input.district,
      city: input.city,
      state: input.state,
      isDefault,
    },
  })
  res.status(201).json(address)
}

export async function deleteAddress(req: Request, res: Response) {
  const user = await requireUser(req)
  const address = await prisma.address.findFirst({ where: { id: String(req.params.id ?? ''), userId: user.id } })
  if (!address) throw new ApiError(404, 'NOT_FOUND', 'Endereço não encontrado')

  await prisma.address.delete({ where: { id: address.id } })
  // Removido o padrão: promove o mais recente para o resumo continuar apontando um CEP
  if (address.isDefault) {
    const next = await prisma.address.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
    if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } })
  }
  res.json({ ok: true })
}
