// ensure serial is always string when written/read
export function canonicalSerial(serial) {
  // Accept bigint, number or string
  if (serial === null || serial === undefined) return "";
  if (typeof serial === "bigint") return serial.toString();
  if (typeof serial === "number") return String(Math.trunc(serial));
  return String(serial);
}

// canonical listing doc id: use tokenId and serial
export function listingDocId(tokenId, serial) {
  return `${tokenId}-${canonicalSerial(serial)}`; // matches earlier code
}
