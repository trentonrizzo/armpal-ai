import Foundation
import Capacitor
import StoreKit

@objc(PurchasePlugin)
public class PurchasePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PurchasePlugin"
    public let jsName = "PurchasePlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkEntitlements", returnType: CAPPluginReturnPromise)
    ]

    private var productsById: [String: Product] = [:]

    @objc func initialize(_ call: CAPPluginCall) {
        let ids = call.getArray("productIds", String.self) ?? []
        Task {
            do {
                let products = try await Product.products(for: ids)
                var map: [String: Product] = [:]
                for product in products {
                    map[product.id] = product
                }
                productsById = map

                let primaryId = ids.first ?? ""
                let hasEntitlement = await hasActiveEntitlement(productId: primaryId)
                let productPayload = map[primaryId].map { p in
                    return [
                        "id": p.id,
                        "displayName": p.displayName,
                        "description": p.description,
                        "displayPrice": p.displayPrice
                    ]
                }

                call.resolve([
                    "product": productPayload as Any,
                    "hasActiveEntitlement": hasEntitlement
                ])
            } catch {
                call.reject("Failed to load products: \(error.localizedDescription)")
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId"), !productId.isEmpty else {
            call.reject("Missing productId")
            return
        }

        Task {
            do {
                let product = try await resolveProduct(productId: productId)
                let result = try await product.purchase()

                switch result {
                case .success(let verificationResult):
                    switch verificationResult {
                    case .verified(let transaction):
                        await transaction.finish()
                        call.resolve([
                            "status": "success",
                            "verified": true,
                            "productId": transaction.productID
                        ])
                    case .unverified(_, let verificationError):
                        call.resolve([
                            "status": "verificationFailed",
                            "verified": false,
                            "message": verificationError.localizedDescription
                        ])
                    }
                case .userCancelled:
                    call.resolve(["status": "userCancelled"])
                case .pending:
                    call.resolve(["status": "pending"])
                @unknown default:
                    call.resolve(["status": "failed"])
                }
            } catch {
                call.reject("Purchase failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        let productId = call.getString("productId") ?? ""
        Task {
            do {
                try await AppStore.sync()
                let active = await hasActiveEntitlement(productId: productId)
                call.resolve(["hasActiveEntitlement": active])
            } catch {
                call.reject("Restore failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func checkEntitlements(_ call: CAPPluginCall) {
        let productId = call.getString("productId") ?? ""
        Task {
            let active = await hasActiveEntitlement(productId: productId)
            call.resolve(["hasActiveEntitlement": active])
        }
    }

    private func resolveProduct(productId: String) async throws -> Product {
        if let product = productsById[productId] {
            return product
        }
        let products = try await Product.products(for: [productId])
        guard let product = products.first else {
            throw NSError(domain: "PurchasePlugin", code: 404, userInfo: [
                NSLocalizedDescriptionKey: "Product not found: \(productId)"
            ])
        }
        productsById[productId] = product
        return product
    }

    private func hasActiveEntitlement(productId: String) async -> Bool {
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result else { continue }

            if !productId.isEmpty, transaction.productID != productId {
                continue
            }
            if transaction.revocationDate != nil {
                continue
            }
            if let expirationDate = transaction.expirationDate, expirationDate <= Date() {
                continue
            }
            return true
        }
        return false
    }
}
