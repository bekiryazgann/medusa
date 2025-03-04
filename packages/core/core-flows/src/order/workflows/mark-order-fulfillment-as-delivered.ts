import {
  FulfillmentDTO,
  OrderDTO,
  RegisterOrderDeliveryDTO,
} from "@medusajs/framework/types"
import { FulfillmentEvents, Modules } from "@medusajs/framework/utils"
import {
  WorkflowData,
  WorkflowResponse,
  createStep,
  createWorkflow,
  parallelize,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { emitEventStep, useRemoteQueryStep } from "../../common"
import { markFulfillmentAsDeliveredWorkflow } from "../../fulfillment"
import { registerOrderDeliveryStep } from "../steps/register-delivery"
import {
  throwIfItemsDoesNotExistsInOrder,
  throwIfOrderIsCancelled,
} from "../utils/order-validation"

/**
 * The data to validate the order fulfillment deliverability.
 */
export type OrderFulfillmentDeliverabilityValidationStepInput = {
  /**
   * The order to validate the fulfillment deliverability for.
   */
  order: OrderDTO & { 
    /**
     * The fulfillments in the order.
     */
    fulfillments: FulfillmentDTO[]
  }
  /**
   * The fulfillment to validate the deliverability for.
   */
  fulfillment: FulfillmentDTO
}

export const orderFulfillmentDeliverablilityValidationStepId =
  "order-fulfillment-deliverability-validation"
/**
 * This step validates that the order fulfillment can be delivered. If the order is cancelled,
 * the items to mark as delivered don't exist in the order, or the fulfillment doesn't exist in the order,
 * the step will throw an error.
 * 
 * :::note
 * 
 * You can retrieve an order and fulfillment's details using [Query](https://docs.medusajs.com/learn/fundamentals/module-links/query),
 * or [useQueryGraphStep](https://docs.medusajs.com/resources/references/medusa-workflows/steps/useQueryGraphStep).
 * 
 * :::
 * 
 * @example
 * const data = orderFulfillmentDeliverablilityValidationStep({
 *   order: {
 *     id: "order_123",
 *     fulfillments: [
 *       {
 *         id: "ful_123",
 *         // other fulfillment details...
 *       }
 *     ]
 *     // other order details...
 *   },
 *   fulfillment: {
 *     id: "ful_123",
 *     // other fulfillment details...
 *   }
 * })
 */
export const orderFulfillmentDeliverablilityValidationStep = createStep(
  orderFulfillmentDeliverablilityValidationStepId,
  async ({
    fulfillment,
    order,
  }: {
    order: OrderDTO & { fulfillments: FulfillmentDTO[] }
    fulfillment: FulfillmentDTO
  }) => {
    throwIfOrderIsCancelled({ order })

    const orderFulfillment = order.fulfillments?.find(
      (f) => f.id === fulfillment.id
    )

    if (!orderFulfillment) {
      throw new Error(
        `Fulfillment with id ${fulfillment.id} not found in the order`
      )
    }

    throwIfItemsDoesNotExistsInOrder({
      order,
      inputItems: order.items!.map((i) => ({
        id: i.id,
        quantity: i.quantity,
      })),
    })
  }
)

function prepareRegisterDeliveryData({
  fulfillment,
  order,
}: {
  fulfillment: FulfillmentDTO
  order: OrderDTO & { fulfillments: FulfillmentDTO[] }
}): RegisterOrderDeliveryDTO {
  const orderFulfillment = order.fulfillments.find(
    (f) => f.id === fulfillment.id
  )!

  return {
    order_id: order.id,
    reference: Modules.FULFILLMENT,
    reference_id: orderFulfillment.id,
    items: orderFulfillment.items!.map((i) => {
      return {
        id: i.line_item_id!,
        quantity: i.quantity!,
      }
    }),
  }
}

/**
 * The details to mark a fulfillment in an order as delivered.
 */
export type MarkOrderFulfillmentAsDeliveredWorkflowInput = {
  /**
   * The ID of the order to mark the fulfillment as delivered in.
   */
  orderId: string
  /**
   * The ID of the fulfillment to mark as delivered.
   */
  fulfillmentId: string
}

export const markOrderFulfillmentAsDeliveredWorkflowId =
  "mark-order-fulfillment-as-delivered-workflow"
/**
 * This workflow marks a fulfillment in an order as delivered. It's used by the
 * [Mark Fulfillment as Delivered Admin API Route](https://docs.medusajs.com/api/admin#orders_postordersidfulfillmentsfulfillment_idmarkasdelivered).
 * 
 * You can use this workflow within your customizations or your own custom workflows, allowing you to wrap custom logic around
 * marking a fulfillment as delivered.
 * 
 * @example
 * const { result } = await markOrderFulfillmentAsDeliveredWorkflow(container)
 * .run({
 *   input: {
 *     orderId: "order_123",
 *     fulfillmentId: "ful_123",
 *   }
 * })
 * 
 * @summary
 * 
 * Mark a fulfillment in an order as delivered.
 */
export const markOrderFulfillmentAsDeliveredWorkflow = createWorkflow(
  markOrderFulfillmentAsDeliveredWorkflowId,
  (input: WorkflowData<MarkOrderFulfillmentAsDeliveredWorkflowInput>) => {
    const { fulfillmentId, orderId } = input
    const fulfillment = useRemoteQueryStep({
      entry_point: "fulfillment",
      fields: ["id"],
      variables: { id: fulfillmentId },
      throw_if_key_not_found: true,
      list: false,
    })

    const order = useRemoteQueryStep({
      entry_point: "order",
      fields: [
        "id",
        "summary",
        "currency_code",
        "region_id",
        "fulfillments.id",
        "fulfillments.items.id",
        "fulfillments.items.quantity",
        "fulfillments.items.line_item_id",
        "items.id",
        "items.quantity",
      ],
      variables: { id: orderId },
      throw_if_key_not_found: true,
      list: false,
    }).config({ name: "order-query" })

    orderFulfillmentDeliverablilityValidationStep({ order, fulfillment })

    const deliveryData = transform(
      { order, fulfillment },
      prepareRegisterDeliveryData
    )

    const [deliveredFulfillment] = parallelize(
      markFulfillmentAsDeliveredWorkflow.runAsStep({
        input: { id: fulfillment.id },
      }),
      registerOrderDeliveryStep(deliveryData)
    )

    emitEventStep({
      eventName: FulfillmentEvents.DELIVERY_CREATED,
      data: { id: deliveredFulfillment.id },
    })

    return new WorkflowResponse(void 0)
  }
)
