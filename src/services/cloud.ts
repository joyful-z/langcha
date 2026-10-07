import Taro from '@tarojs/taro'

const isWeapp = process.env.TARO_ENV === 'weapp'

export async function callFunction<T = any>(
  name: string,
  data?: Record<string, any>
): Promise<T> {
  if (!isWeapp) {
    throw new Error(`当前 TARO_ENV=${process.env.TARO_ENV || 'unknown'}，不会调用微信云函数 ${name}。请使用 npm run dev:weapp 或 build:weapp 在微信开发者工具中验证 Kimi。`)
  }
  const res = await Taro.cloud.callFunction({ name, data })
  const result = res.result as { code: number; message: string; data: T }
  if (!result) {
    throw new Error(`云函数 ${name} 没有返回结果，请检查函数是否已部署到当前云环境`)
  }
  if (result.code !== 0) {
    console.error(`[Cloud] ${name} failed:`, result.message)
    throw new Error(result.message || '请求失败')
  }
  return result.data
}

export function getDatabase() {
  if (!isWeapp) {
    return null
  }
  return Taro.cloud.database()
}
