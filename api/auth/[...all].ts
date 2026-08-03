import { auth } from "../../server/auth"

export function GET(request: Request): Promise<Response> {
  return auth.handler(request)
}

export function POST(request: Request): Promise<Response> {
  return auth.handler(request)
}