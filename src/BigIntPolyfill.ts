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
