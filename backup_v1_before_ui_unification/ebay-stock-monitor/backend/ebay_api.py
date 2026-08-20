import httpx
import xml.etree.ElementTree as ET
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class EbayAPIClient:
    """
    eBay Trading API / REST API を使用して、出品取り下げ（End Fixed Price Item）
    または 在庫数ゼロ化（Revise Inventory Status）を実行するクライアント
    """
    TRADING_API_ENDPOINT_PROD = "https://api.ebay.com/ws/api.dll"
    TRADING_API_ENDPOINT_SANDBOX = "https://api.sandbox.ebay.com/ws/api.dll"

    def __init__(self, dev_id: str = "", app_id: str = "", cert_id: str = "", user_token: str = "", is_sandbox: bool = False):
        self.dev_id = dev_id.strip() if dev_id else ""
        self.app_id = app_id.strip() if app_id else ""
        self.cert_id = cert_id.strip() if cert_id else ""
        self.user_token = user_token.strip() if user_token else ""
        self.is_sandbox = is_sandbox
        self.endpoint = self.TRADING_API_ENDPOINT_SANDBOX if is_sandbox else self.TRADING_API_ENDPOINT_PROD

    def is_configured(self) -> bool:
        """APIキー・トークンが設定されているかチェック"""
        return bool(self.user_token and len(self.user_token) > 10)

    def _get_headers(self, call_name: str, site_id: int = 0) -> Dict[str, str]:
        headers = {
            "X-EBAY-API-COMPATIBILITY-LEVEL": "1231",
            "X-EBAY-API-CALL-NAME": call_name,
            "X-EBAY-API-SITEID": str(site_id),
            "Content-Type": "text/xml; charset=utf-8",
        }
        if self.dev_id:
            headers["X-EBAY-API-DEV-NAME"] = self.dev_id
        if self.app_id:
            headers["X-EBAY-API-APP-NAME"] = self.app_id
        if self.cert_id:
            headers["X-EBAY-API-CERT-NAME"] = self.cert_id
        return headers

    def end_fixed_price_item(self, item_id: str, ending_reason: str = "NotAvailable") -> Dict[str, Any]:
        """
        eBay上の出品を完全終了（End Fixed Price Item）する
        ending_reason: NotAvailable, Incorrect, LostOrBroken, OtherListingBreach
        """
        item_id = str(item_id).strip()
        if not self.is_configured():
            logger.warning(f"[eBay API] 未設定のためシミュレーション動作（取り下げ成功）: ItemID={item_id}")
            return {
                "success": True,
                "simulated": True,
                "item_id": item_id,
                "message": "eBay APIキー未設定のためシミュレーション取り下げ完了として記録しました。"
            }

        headers = self._get_headers("EndFixedPriceItem")
        xml_body = f"""<?xml version="1.0" encoding="utf-8"?>
<EndFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>{self.user_token}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>{item_id}</ItemID>
  <EndingReason>{ending_reason}</EndingReason>
</EndFixedPriceItemRequest>"""

        try:
            response = httpx.post(self.endpoint, content=xml_body.encode('utf-8'), headers=headers, timeout=15)
            return self._parse_trading_response(response.text, item_id, "EndFixedPriceItem")
        except Exception as e:
            logger.error(f"[eBay API] EndFixedPriceItem リクエストエラー: {e}")
            return {"success": False, "item_id": item_id, "error": str(e)}

    def revise_quantity_zero(self, item_id: str) -> Dict[str, Any]:
        """
        eBay上の出品の在庫数を0に変更（Revise Inventory Status）する
        ※ Out of Stock Control 設定有効時に出品非表示化
        """
        item_id = str(item_id).strip()
        if not self.is_configured():
            logger.warning(f"[eBay API] 未設定のためシミュレーション動作（在庫0化成功）: ItemID={item_id}")
            return {
                "success": True,
                "simulated": True,
                "item_id": item_id,
                "message": "eBay APIキー未設定のためシミュレーション在庫0化完了として記録しました。"
            }

        headers = self._get_headers("ReviseInventoryStatus")
        xml_body = f"""<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>{self.user_token}</eBayAuthToken>
  </RequesterCredentials>
  <InventoryStatus>
    <ItemID>{item_id}</ItemID>
    <Quantity>0</Quantity>
  </InventoryStatus>
</ReviseInventoryStatusRequest>"""

        try:
            response = httpx.post(self.endpoint, content=xml_body.encode('utf-8'), headers=headers, timeout=15)
            return self._parse_trading_response(response.text, item_id, "ReviseInventoryStatus")
        except Exception as e:
            logger.error(f"[eBay API] ReviseInventoryStatus リクエストエラー: {e}")
            return {"success": False, "item_id": item_id, "error": str(e)}

    def _parse_trading_response(self, xml_str: str, item_id: str, action_name: str) -> Dict[str, Any]:
        try:
            root = ET.fromstring(xml_str)
            ack_node = root.find(".//{*}Ack")
            ack = ack_node.text if ack_node is not None else "Failure"

            if ack in ["Success", "Warning"]:
                endTime_node = root.find(".//{*}EndTime")
                end_time = endTime_node.text if endTime_node is not None else ""
                return {
                    "success": True,
                    "item_id": item_id,
                    "action": action_name,
                    "end_time": end_time,
                    "raw_ack": ack
                }
            else:
                errors = []
                for err_node in root.findall(".//{*}Errors"):
                    short_msg = err_node.find("{*}ShortMessage")
                    long_msg = err_node.find("{*}LongMessage")
                    msg = (long_msg.text if long_msg is not None else "") or (short_msg.text if short_msg is not None else "")
                    code = err_node.find("{*}ErrorCode")
                    code_str = code.text if code is not None else ""
                    errors.append(f"[{code_str}] {msg}")
                err_text = " / ".join(errors) if errors else "eBay API returned Failure"
                return {
                    "success": False,
                    "item_id": item_id,
                    "action": action_name,
                    "error": err_text,
                    "raw_xml": xml_str[:500]
                }
        except Exception as e:
            return {"success": False, "item_id": item_id, "error": f"XML解析エラー: {e}"}
