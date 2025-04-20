import { productRx } from "@/Product/rx"
import { useRxValue } from "@effect-rx/rx-react"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/product/$id")({
  component: ProductScreen,
})

export function ProductScreen() {
  const { id } = Route.useParams()
  const product = useRxValue(productRx(id))
  if (product._tag !== "Success") {
    return null
  }
  return (
    <div className="py-10">
      <div className="h-72 w-full">
        <img
          src={product.value.imageurl}
          alt={product.value.title}
          className="h-full mx-auto"
        />
      </div>
      Hello {id}!
    </div>
  )
}
