export const defaultPortions = (groups = []) => groups.map(group => ({ slot_id: group.id, choice_id: group.choices[0].id, addon_ids: [] }))

export function resolvePortions(groups = [], selections = []) {
  const requested = new Map(selections.map(selection => [selection.slot_id, selection]))
  if (!Array.isArray(groups) || requested.size !== selections.length) throw new Error('Lựa chọn không hợp lệ')
  let extraPrice = 0
  const snapshot = groups.map(group => {
    const selection = requested.get(group.id)
    const choice = group.choices.find(choice => choice.id === (selection?.choice_id ?? group.choices[0]?.id))
    if (!choice || group.is_available === false || choice.is_available === false) throw new Error('Món chính không còn phục vụ')
    const ids = selection?.addon_ids ?? []
    if (new Set(ids).size !== ids.length) throw new Error('Phần thêm bị trùng')
    const addons = [...ids].sort().map(id => {
      const addon = choice.addons.find(addon => addon.id === id)
      if (!addon || addon.is_available === false || ![5000, 10000].includes(addon.price)) throw new Error('Phần thêm không còn phục vụ')
      extraPrice += addon.price
      return { id: addon.id, name: addon.name, price: addon.price }
    })
    return { slot_id: group.id, slot_name: group.label, choice_id: choice.id, choice_name: choice.name, addons }
  })
  if (selections.some(selection => !groups.some(group => group.id === selection.slot_id))) throw new Error('Cấu hình phần thêm đã thay đổi')
  return { snapshot, extraPrice }
}

export function portionSummary(portions = []) {
  return portions.filter(slot => slot.slot_id !== 'main' || slot.addons?.length).map(slot => {
    const extras = (slot.addons || []).map(addon => `+ ${addon.name} (${addon.price / 1000}k)`).join(', ')
    return slot.slot_id === 'main' ? extras : `${slot.slot_name}: ${slot.choice_name}${extras ? ` · ${extras}` : ''}`
  }).join('; ')
}
