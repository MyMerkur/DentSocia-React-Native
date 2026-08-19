import { Types } from "mongoose";
import { EMPLOYER_ROLES } from "@dentsocia/shared-constants";
import { env } from "../config/env";
import { findUserById } from "../repositories/user.repository";
import * as eventRepo from "../repositories/event.repository";
import { resolveUserSummary, type UserSummarySource } from "../utils/userSummary";
import { HttpError } from "../utils/httpError";

interface TicketTypeInput {
  name: string;
  price: string;
  capacity: number;
}

interface CreateEventInput {
  title: string;
  description?: string;
  location?: string;
  startsAt: Date;
  endsAt: Date;
  ticketTypes: TicketTypeInput[];
}

export async function requireVerifiedOrganizer(userId: string) {
  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError("Kullanıcı bulunamadı", 404);
  }
  const isAdmin = env.ADMIN_EMAILS.includes(user.email.toLowerCase());
  const isVerifiedEmployer = (EMPLOYER_ROLES as readonly string[]).includes(user.role) && user.kycLevel >= 3;
  if (!isAdmin && !isVerifiedEmployer) {
    throw new HttpError("Etkinlik oluşturmak için kurumsal doğrulama (Level 3) veya yönetici yetkisi gerekli", 403);
  }
  return user;
}

function serializeEvent(
  event: {
    _id: Types.ObjectId;
    title: string;
    description: string;
    location: string;
    startsAt: Date;
    endsAt: Date;
    ticketTypes: { _id: Types.ObjectId; name: string; price: string; capacity: number; soldCount: number }[];
    organizerId: unknown;
    createdAt: Date;
  },
  organizer: Awaited<ReturnType<typeof resolveUserSummary>>,
) {
  return {
    id: event._id.toString(),
    title: event.title,
    description: event.description,
    location: event.location,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    organizer,
    ticketTypes: event.ticketTypes.map((ticket) => ({
      id: ticket._id.toString(),
      name: ticket.name,
      price: ticket.price,
      capacity: ticket.capacity,
      soldCount: ticket.soldCount,
      soldOut: ticket.soldCount >= ticket.capacity,
    })),
    createdAt: event.createdAt,
  };
}

export async function createEvent(userId: string, input: CreateEventInput) {
  const user = await requireVerifiedOrganizer(userId);

  if (input.endsAt.getTime() <= input.startsAt.getTime()) {
    throw new HttpError("Bitiş tarihi başlangıç tarihinden sonra olmalı", 400);
  }

  const created = await eventRepo.create({
    organizerId: userId,
    title: input.title,
    description: input.description ?? "",
    location: input.location ?? "",
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    ticketTypes: input.ticketTypes,
  });

  return serializeEvent(created, await resolveUserSummary(user as unknown as UserSummarySource));
}

export async function listUpcomingEvents() {
  const events = await eventRepo.listUpcoming();
  return Promise.all(
    events.map(async (event) =>
      serializeEvent(event, await resolveUserSummary(event.organizerId as unknown as UserSummarySource)),
    ),
  );
}

export async function listMyOrganizedEvents(userId: string) {
  const user = await requireVerifiedOrganizer(userId);
  const events = await eventRepo.listByOrganizer(userId);
  const organizer = await resolveUserSummary(user as unknown as UserSummarySource);
  return events.map((event) => serializeEvent(event, organizer));
}

export async function getEventOr404(eventId: string) {
  const event = await eventRepo.findById(eventId);
  if (!event) {
    throw new HttpError("Etkinlik bulunamadı", 404);
  }
  return event;
}
