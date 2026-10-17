import { serviceOptions } from "./site";

// Shared by the client form and the /api/enquiry route.

export type Enquiry = {
  name: string;
  instagram: string;
  email: string;
  phone: string;
  service: string;
  message: string;
  footage: string;
};

export type EnquiryErrors = Partial<Record<keyof Enquiry, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s-]{10,16}$/;

export function validateEnquiry(e: Enquiry): EnquiryErrors {
  const errors: EnquiryErrors = {};
  if (e.name.trim().length < 2) errors.name = "Please enter your name.";
  if (!EMAIL_RE.test(e.email.trim())) errors.email = "Please enter a valid email address.";
  const digits = e.phone.replace(/\D/g, "");
  if (!PHONE_RE.test(e.phone.trim()) || digits.length < 10 || digits.length > 13)
    errors.phone = "Please enter a valid phone number (10 digits, country code optional).";
  if (!(serviceOptions as readonly string[]).includes(e.service)) errors.service = "Please pick a service.";
  if (e.message.trim().length < 5) errors.message = "Tell us a little about the project.";
  if (e.footage.trim() && !/^https?:\/\/\S+$/i.test(e.footage.trim()))
    errors.footage = "Link should start with https://";
  return errors;
}
