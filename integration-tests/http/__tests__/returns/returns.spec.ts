import { ModuleRegistrationName, RuleOperator } from "@medusajs/utils"
import { medusaIntegrationTestRunner } from "medusa-test-utils"
import {
  adminHeaders,
  createAdminUser,
} from "../../../helpers/create-admin-user"

jest.setTimeout(30000)

medusaIntegrationTestRunner({
  testSuite: ({ dbConnection, getContainer, api }) => {
    let order
    let returnShippingOption
    let shippingProfile
    let fulfillmentSet

    beforeEach(async () => {
      const container = getContainer()
      await createAdminUser(dbConnection, adminHeaders, container)

      const orderModule = container.resolve(ModuleRegistrationName.ORDER)

      order = await orderModule.createOrders({
        region_id: "test_region_id",
        email: "foo@bar.com",
        items: [
          {
            title: "Custom Item 2",
            quantity: 1,
            unit_price: 50,
          },
        ],
        sales_channel_id: "test",
        shipping_address: {
          first_name: "Test",
          last_name: "Test",
          address_1: "Test",
          city: "Test",
          country_code: "US",
          postal_code: "12345",
          phone: "12345",
        },
        billing_address: {
          first_name: "Test",
          last_name: "Test",
          address_1: "Test",
          city: "Test",
          country_code: "US",
          postal_code: "12345",
        },
        shipping_methods: [
          {
            name: "Test shipping method",
            amount: 10,
            data: {},
            tax_lines: [
              {
                description: "shipping Tax 1",
                tax_rate_id: "tax_usa_shipping",
                code: "code",
                rate: 10,
              },
            ],
          },
        ],
        currency_code: "usd",
        customer_id: "joe",
      })

      shippingProfile = (
        await api.post(
          `/admin/shipping-profiles`,
          {
            name: "Test",
            type: "default",
          },
          adminHeaders
        )
      ).data.shipping_profile

      let location = (
        await api.post(
          `/admin/stock-locations`,
          {
            name: "Test location",
          },
          adminHeaders
        )
      ).data.stock_location

      location = (
        await api.post(
          `/admin/stock-locations/${location.id}/fulfillment-sets?fields=*fulfillment_sets`,
          {
            name: "Test",
            type: "test-type",
          },
          adminHeaders
        )
      ).data.stock_location

      fulfillmentSet = (
        await api.post(
          `/admin/fulfillment-sets/${location.fulfillment_sets[0].id}/service-zones`,
          {
            name: "Test",
            geo_zones: [{ type: "country", country_code: "us" }],
          },
          adminHeaders
        )
      ).data.fulfillment_set

      const shippingOptionPayload = {
        name: "Return shipping",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        provider_id: "manual_test-provider",
        price_type: "flat",
        type: {
          label: "Test type",
          description: "Test description",
          code: "test-code",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 1000,
          },
        ],
        rules: [
          {
            operator: RuleOperator.EQ,
            attribute: "is_return",
            value: "true",
          },
        ],
      }

      returnShippingOption = (
        await api.post(
          "/admin/shipping-options",
          shippingOptionPayload,
          adminHeaders
        )
      ).data.shipping_option

      const item = order.items[0]

      await api.post(
        `/admin/orders/${order.id}/fulfillments`,
        {
          items: [
            {
              id: item.id,
              quantity: 1,
            },
          ],
        },
        adminHeaders
      )
    })

    describe("Returns lifecycle", () => {
      // Simple lifecyle:
      // 1. Initiate return
      // 2. Request to return items
      // 3. Add return shipping
      // 4. Confirm return
      it("should initiate a return", async () => {
        let result = await api.post(
          "/admin/returns",
          {
            order_id: order.id,
            description: "Test",
          },
          adminHeaders
        )

        const returnId = result.data.return.id

        expect(result.data.return).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            order_id: order.id,
            display_id: 1,
            order_version: 2,
            status: "requested",
            items: [],
            shipping_methods: [],
          })
        )

        const item = order.items[0]

        result = await api.post(
          `/admin/returns/${returnId}/request-items`,
          {
            items: [
              {
                id: item.id,
                quantity: 1,
              },
            ],
          },
          adminHeaders
        )

        expect(result.data.return).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            order_id: order.id,
            display_id: 1,
            order_version: 2,
            status: "requested",
            items: [],
            shipping_methods: [],
          })
        )

        result = await api.post(
          `/admin/returns/${returnId}/shipping-method`,
          {
            shipping_option_id: returnShippingOption.id,
          },
          adminHeaders
        )

        expect(result.data.return).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            order_id: order.id,
            display_id: 1,
            order_version: 2,
            status: "requested",
            items: [],
            shipping_methods: [
              expect.objectContaining({
                amount: 1000,
                name: "Return shipping",
                shipping_option_id: returnShippingOption.id,
              }),
            ],
          })
        )

        result = await api.post(
          `/admin/returns/${returnId}/request`,
          {},
          adminHeaders
        )

        expect(result.data.return).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            order_id: order.id,
            display_id: 1,
            order_version: 2,
            status: "requested",
            items: [
              expect.objectContaining({
                quantity: 1,
                item_id: item.id,
                received_quantity: 0,
              }),
            ],
            shipping_methods: [
              expect.objectContaining({
                amount: 1000,
                name: "Return shipping",
                shipping_option_id: returnShippingOption.id,
              }),
            ],
          })
        )
      })
    })
  },
})