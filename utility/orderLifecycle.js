const Order = require("../models/Order")
const Property = require("../models/Property")
const notify = require("./notify")

// Keep the lifecycle rules centralized so route handlers and background jobs
// always use the same expiry logic.
const ORDER_WINDOW_HOURS = 72
const ACTIVE_ORDER_STATUSES = new Set(["pending", "accepted"])
const TERMINAL_ORDER_STATUSES = new Set(["cancelled", "rejected", "completed", "expired"])

const normalize = (value = "") => value.toString().toLowerCase().trim()

const getPropertyStatusForOrder = (orderStatus, listingType = "") => {
  const status = normalize(orderStatus)
  const type = normalize(listingType)

  if (status === "cancelled" || status === "rejected" || status === "expired") return "available"
  if (status === "completed") return type === "sale" ? "archived" : "rented"
  if (status === "pending" || status === "accepted" || status === "pending_proof") return "reserved"

  return null
}

const orderSnapshot = (order) => {
  const property = order?.property || {}
  return {
    title: property.title || "",
    price: property.amount ? `₦${Number(property.amount).toLocaleString("en-NG")}` : "",
    image: property.media?.[0]?.url || "",
    location: [property.location?.town, property.location?.state].filter(Boolean).join(", "),
  }
}

const syncPropertyStatusFromOrder = async (order, nextStatus) => {
  const propertyId = order?.property?._id || order?.property
  if (!propertyId) return null

  const listingType = order?.property?.listing_type || ""
  const propertyStatus = getPropertyStatusForOrder(nextStatus, listingType)
  if (!propertyStatus) return null

  await Property.findByIdAndUpdate(propertyId, { status: propertyStatus })
  return propertyStatus
}

const expireOverdueOrders = async () => {
  const now = new Date()
  const overdueOrders = await Order.find({
    status: { $in: [...ACTIVE_ORDER_STATUSES] },
    expiresAt: { $lte: now },
  }).populate("property", "title amount listing_type location media")

  for (const order of overdueOrders) {
    if (TERMINAL_ORDER_STATUSES.has(normalize(order.status))) continue

    order.status = "expired"
    if (["unpaid", "pending_proof"].includes(normalize(order.paymentStatus))) {
      order.paymentStatus = "failed"
    }

    await order.save()
    await syncPropertyStatusFromOrder(order, "expired")

    if (order.buyer) {
      await notify({
        recipient: order.buyer,
        sender: order.seller || null,
        type: "order_expired",
        targetType: "Order",
        targetId: order._id,
        snapshot: orderSnapshot(order),
      })
    }

    if (order.seller) {
      await notify({
        recipient: order.seller,
        sender: order.buyer || null,
        type: "order_expired",
        targetType: "Order",
        targetId: order._id,
        snapshot: orderSnapshot(order),
      })
    }
  }
}

module.exports = {
  ORDER_WINDOW_HOURS,
  ACTIVE_ORDER_STATUSES,
  TERMINAL_ORDER_STATUSES,
  expireOverdueOrders,
}
