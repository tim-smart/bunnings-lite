import { EventGroup } from "effect/eventlog"
import { ProductBaseInfo } from "../../../server/src/domain/Bunnings.ts"

export const FavoriteEvents = EventGroup.empty
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
  })
