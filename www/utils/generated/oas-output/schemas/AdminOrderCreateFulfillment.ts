/**
 * @schema AdminOrderCreateFulfillment
 * type: object
 * description: SUMMARY
 * x-schemaName: AdminOrderCreateFulfillment
 * required:
 *   - items
 *   - location_id
 *   - metadata
 * properties:
 *   items:
 *     type: array
 *     description: The order's items.
 *     items:
 *       type: object
 *       description: The item's items.
 *       required:
 *         - id
 *         - quantity
 *       properties:
 *         id:
 *           type: string
 *           title: id
 *           description: The item's ID.
 *         quantity:
 *           type: number
 *           title: quantity
 *           description: The item's quantity.
 *   location_id:
 *     type: string
 *     title: location_id
 *     description: The order's location id.
 *   no_notification:
 *     type: boolean
 *     title: no_notification
 *     description: The order's no notification.
 *   metadata:
 *     type: object
 *     description: The order's metadata.
 * 
*/
