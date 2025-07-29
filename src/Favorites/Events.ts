import { EventGroup } from "@effect/experimental"
import { ProductBaseInfo } from "../../server/src/domain/Bunnings"

export class FavoriteEvents extends EventGroup.empty
  .add({
    tag: "FavoriteAdd",
    primaryKey: () => "",
    payload: ProductBaseInfo,
  })
  .add({
    tag: "FavoriteRemove",
    primaryKey: () => "",
    payload: ProductBaseInfo.fields.id,
  })
  .add({
    tag: "FavoritesClear",
    primaryKey: () => "",
  }) {}
