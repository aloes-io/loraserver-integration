function Decode(fPort, bytes) {
  return { data: String.fromCharCode.apply(null, bytes), fPort };
}
