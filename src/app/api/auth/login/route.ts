import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/auth";

const DEMO_EMAIL = "admin@anhhung.vn";
const DEMO_PASSWORD = "123456";

function createLoginResponse(id: string, role: string) {
  const response = NextResponse.json({ success: true });
  return signToken({ id, role }).then((token) => {
    response.cookies.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return response;
  });
}

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
    return createLoginResponse("demo-admin", "ADMIN");
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    return createLoginResponse(user.id, user.role);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
