import { ProductBaseInfo } from "../../server/src/domain/Bunnings"
import * as EventGroup from "effect/unstable/eventlog/EventGroup"

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
