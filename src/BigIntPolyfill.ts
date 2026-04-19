if (typeof globalThis.BigInt === "undefined") {
  globalThis.BigInt = ((input: string | number | bigint) => {
    return Math.floor(Number(input))
  }) as any
}

if (typeof (Object as any).hasOwn === "undefined") {
  ;(Object as any).hasOwn = function (obj: any, prop: string) {
    return Object.prototype.hasOwnProperty.call(obj, prop)
  }
}

if (typeof crypto.randomUUID === "undefined") {
  crypto.randomUUID = function () {
    const value = crypto.getRandomValues(new Uint8Array(16))
    value[6] = (value[6] & 0x0f) | 0x40
    value[8] = (value[8] & 0x3f) | 0x80
    return Array.from(value)
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("") as any
  }
}
