import { app } from './app'
import { assertProductionEnv } from './lib/env'

assertProductionEnv()

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10)
app.listen(PORT, () => console.log(`API em http://localhost:${PORT}/api/v1/health`))
