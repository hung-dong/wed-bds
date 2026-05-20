"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireUser() {
  const token = (await cookies()).get("auth_token")?.value;
  if (!token) {
    throw new Error("Unauthorized");
  }

  const payload = await verifyToken(token);
  if (!payload) {
    throw new Error("Unauthorized");
  }

  return payload;
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function number(formData: FormData, key: string) {
  const raw = text(formData, key).replace(/[,\s]/g, "");
  return Number(raw);
}

function refreshDashboard() {
  revalidatePath("/", "layout");
}

const propertySchema = z.object({
  title: z.string().min(2),
  address: z.string().min(2),
  status: z.enum(["AVAILABLE", "NEGOTIATING", "SOLD", "HOLD"]),
  legalStatus: z.string().min(2),
  value: z.number().nonnegative(),
});

export async function createProperty(formData: FormData) {
  await requireUser();
  const data = propertySchema.parse({
    title: text(formData, "title"),
    address: text(formData, "address"),
    status: text(formData, "status"),
    legalStatus: text(formData, "legalStatus"),
    value: number(formData, "value"),
  });

  await prisma.property.create({ data });
  refreshDashboard();
}

const leadSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  status: z.enum(["NEW", "FOLLOW_UP", "HOT", "WON", "LOST"]),
});

export async function createLead(formData: FormData) {
  await requireUser();
  const data = leadSchema.parse({
    name: text(formData, "name"),
    phone: text(formData, "phone"),
    status: text(formData, "status"),
  });

  await prisma.lead.create({ data });
  refreshDashboard();
}

const taskSchema = z.object({
  title: z.string().min(2),
  urgency: z.number().int().min(1).max(5),
  value: z.number().int().min(1).max(5),
});

export async function createTask(formData: FormData) {
  await requireUser();
  const data = taskSchema.parse({
    title: text(formData, "title"),
    urgency: number(formData, "urgency"),
    value: number(formData, "value"),
  });

  await prisma.task.create({ data });
  refreshDashboard();
}

export async function toggleTask(formData: FormData) {
  await requireUser();
  const id = z.string().min(1).parse(text(formData, "id"));
  const task = await prisma.task.findUnique({
    where: { id },
    select: { isDone: true },
  });

  if (!task) {
    return;
  }

  await prisma.task.update({
    where: { id },
    data: { isDone: !task.isDone },
  });
  refreshDashboard();
}

const transactionSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(["INCOME", "EXPENSE"]),
  note: z.string().min(2),
});

export async function createTransaction(formData: FormData) {
  await requireUser();
  const data = transactionSchema.parse({
    amount: number(formData, "amount"),
    type: text(formData, "type"),
    note: text(formData, "note"),
  });

  await prisma.transaction.create({ data });
  refreshDashboard();
}
