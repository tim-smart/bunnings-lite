import { Context, Layer, Option } from "effect"
import type { ProductBaseInfo } from "../../../server/src/domain/Bunnings.ts"

/**
 * The products this page has already been told about, by a search or by the
 * favourites. A product page opens with what is here while its details load.
 */
export class KnownProducts extends Context.Service<
  KnownProducts,
  {
    readonly remember: (products: Iterable<ProductBaseInfo>) => void
    readonly find: (id: string) => Option.Option<ProductBaseInfo>
  }
>()("product/KnownProducts") {
  static readonly layer = Layer.sync(KnownProducts, () => {
    const known = new Map<string, ProductBaseInfo>()
    return {
      remember: (products) => {
        for (const product of products) known.set(product.id, product)
      },
      find: (id) => Option.fromNullishOr(known.get(id)),
    }
  })
}
