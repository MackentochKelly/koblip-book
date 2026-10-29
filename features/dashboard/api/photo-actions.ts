"use server"

import { and, asc, eq } from "drizzle-orm"
import { deletePhoto, savePhoto } from "@/lib/uploads"
import { UPLOAD_RULES } from "@/lib/upload-rules"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import {
  businessPhotos,
  services,
  teamMembers,
} from "@/lib/db/schema"
import { ownedBusiness, revalidateBusiness } from "./owned-business"
import type { OwnerPhoto, PhotoResult } from "../media-types"

function fileFrom(formData: FormData): File {
  return formData.get("file") as File
}

export async function uploadBusinessPhoto(
  businessId: string,
  formData: FormData
): Promise<PhotoResult<{ photo: OwnerPhoto }>> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const existing = await db
    .select({ id: businessPhotos.id, position: businessPhotos.position })
    .from(businessPhotos)
    .where(eq(businessPhotos.businessId, owned.business.id))
    .orderBy(asc(businessPhotos.position))
  if (existing.length >= UPLOAD_RULES.maxBusinessPhotos) {
    return { ok: false, error: "limit" }
  }
  const saved = await savePhoto(fileFrom(formData))
  if (!saved.ok) {
    return { ok: false, error: saved.error }
  }
  const position =
    existing.length === 0
      ? 0
      : Math.max(...existing.map((row) => row.position)) + 1
  const id = crypto.randomUUID()
  try {
    await db.insert(businessPhotos).values({
      id,
      businessId: owned.business.id,
      url: saved.url,
      position,
    })
  } catch (error) {
    await deletePhoto(saved.url)
    throw error
  }
  revalidateBusiness(owned.business.slug)
  return { ok: true, photo: { id, url: saved.url } }
}

export async function deleteBusinessPhoto(
  businessId: string,
  photoId: string
): Promise<PhotoResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const [row] = await db
    .select({ id: businessPhotos.id, url: businessPhotos.url })
    .from(businessPhotos)
    .where(
      and(
        eq(businessPhotos.id, photoId),
        eq(businessPhotos.businessId, owned.business.id)
      )
    )
    .limit(1)
  if (!row) {
    return { ok: false, error: "not_found" }
  }
  await db.delete(businessPhotos).where(eq(businessPhotos.id, row.id))
  await deletePhoto(row.url)
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

export async function reorderBusinessPhotos(
  businessId: string,
  photoIds: string[]
): Promise<PhotoResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const existing = await db
    .select({ id: businessPhotos.id })
    .from(businessPhotos)
    .where(eq(businessPhotos.businessId, owned.business.id))
  const existingIds = new Set(existing.map((row) => row.id))
  if (
    !Array.isArray(photoIds) ||
    photoIds.length !== existing.length ||
    !photoIds.every((id) => existingIds.has(id))
  ) {
    return { ok: false, error: "not_found" }
  }
  await saveAll(
    photoIds.map((id, position) =>
      db
        .update(businessPhotos)
        .set({ position })
        .where(eq(businessPhotos.id, id))
    )
  )
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

export async function setServicePhoto(
  businessId: string,
  serviceId: string,
  formData: FormData
): Promise<PhotoResult<{ photoUrl: string }>> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const [service] = await db
    .select({ id: services.id, photoUrl: services.photoUrl })
    .from(services)
    .where(
      and(
        eq(services.id, serviceId),
        eq(services.businessId, owned.business.id)
      )
    )
    .limit(1)
  if (!service) {
    return { ok: false, error: "not_found" }
  }
  const saved = await savePhoto(fileFrom(formData))
  if (!saved.ok) {
    return { ok: false, error: saved.error }
  }
  try {
    await db
      .update(services)
      .set({ photoUrl: saved.url })
      .where(eq(services.id, service.id))
  } catch (error) {
    await deletePhoto(saved.url)
    throw error
  }
  await deletePhoto(service.photoUrl)
  revalidateBusiness(owned.business.slug)
  return { ok: true, photoUrl: saved.url }
}

export async function removeServicePhoto(
  businessId: string,
  serviceId: string
): Promise<PhotoResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const [service] = await db
    .select({ id: services.id, photoUrl: services.photoUrl })
    .from(services)
    .where(
      and(
        eq(services.id, serviceId),
        eq(services.businessId, owned.business.id)
      )
    )
    .limit(1)
  if (!service) {
    return { ok: false, error: "not_found" }
  }
  await db
    .update(services)
    .set({ photoUrl: null })
    .where(eq(services.id, service.id))
  await deletePhoto(service.photoUrl)
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

export async function setTeamMemberPhoto(
  businessId: string,
  teamMemberId: string,
  formData: FormData
): Promise<PhotoResult<{ photoUrl: string }>> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const [member] = await db
    .select({ id: teamMembers.id, photoUrl: teamMembers.photoUrl })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.id, teamMemberId),
        eq(teamMembers.businessId, owned.business.id)
      )
    )
    .limit(1)
  if (!member) {
    return { ok: false, error: "not_found" }
  }
  const saved = await savePhoto(fileFrom(formData))
  if (!saved.ok) {
    return { ok: false, error: saved.error }
  }
  try {
    await db
      .update(teamMembers)
      .set({ photoUrl: saved.url })
      .where(eq(teamMembers.id, member.id))
  } catch (error) {
    await deletePhoto(saved.url)
    throw error
  }
  await deletePhoto(member.photoUrl)
  revalidateBusiness(owned.business.slug)
  return { ok: true, photoUrl: saved.url }
}

export async function removeTeamMemberPhoto(
  businessId: string,
  teamMemberId: string
): Promise<PhotoResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const [member] = await db
    .select({ id: teamMembers.id, photoUrl: teamMembers.photoUrl })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.id, teamMemberId),
        eq(teamMembers.businessId, owned.business.id)
      )
    )
    .limit(1)
  if (!member) {
    return { ok: false, error: "not_found" }
  }
  await db
    .update(teamMembers)
    .set({ photoUrl: null })
    .where(eq(teamMembers.id, member.id))
  await deletePhoto(member.photoUrl)
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}
