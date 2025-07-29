import { EventGroup } from "@effect/experimental"
import { ProductBaseInfo } from "../../server/src/domain/Bunnings"

export class FavoriteEvents extends EventGroup.empty
  .add({
    tag: "FavoriteAdd",
    primaryKey: (info) => info.id,
    payload: ProductBaseInfo,
  })
  .add({
    tag: "FavoriteRemove",
    primaryKey: (id) => id,
    payload: ProductBaseInfo.fields.id,
  })
  .add({
    tag: "FavoritesClear",
    primaryKey: () => "",
  }) {}
