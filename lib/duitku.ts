import crypto from "crypto";

export function createSignature(
  merchantCode: string,
  merchantOrderId: string,
  amount: number,
  apiKey: string,
) {
  return crypto
    .createHash("md5")
    .update(merchantCode + merchantOrderId + amount + apiKey)
    .digest("hex");
}
