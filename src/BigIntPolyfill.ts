if (typeof globalThis.BigInt === "undefined") {
  globalThis.BigInt = ((input: string | number | bigint) => {
    return Math.floor(Number(input))
  }) as any
}
