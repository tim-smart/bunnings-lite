import { productRx } from "@/Product/rx"
import { resultsRx } from "@/Search/rx"
import { useRxMount, useRxValue } from "@effect-rx/rx-react"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/product/$id")({
  component: ProductScreen,
})

export function ProductScreen() {
  // Keep the search results alive
  useRxMount(resultsRx)

  const { id } = Route.useParams()
  const product = useRxValue(productRx(id))
  if (product._tag !== "Success") {
    return null
  }
  return (
    <div className="flex flex-col py-10 w-full px-4">
      <div className="h-72 w-full">
        <img
          src={product.value.imageurl}
          alt={product.value.title}
          className="h-full mx-auto"
        />
      </div>

      <div className="h-5" />

      <h1 className="font-black text-2xl">{product.value.title}</h1>
      <h3 className="font-black text-gray-600 text-xl">
        ${product.value.price_9454}
      </h3>
    </div>
  )
}
