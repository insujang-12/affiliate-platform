import { NextResponse } from 'next/server';

const SCRIPT = `(function() {
  // URL에서 affiliate_code 추출해서 쿠키에 저장
  var urlParams = new URLSearchParams(window.location.search);
  var affiliateCode = urlParams.get('affiliate_code');
  if (affiliateCode) {
    document.cookie = 'affiliate_code=' + affiliateCode + '; path=/; max-age=2592000';
    document.cookie = 'utm_campaign=' + affiliateCode + '; path=/; max-age=2592000';
  }

  // 주문 완료 페이지에서 우리 서버로 전송
  if (window.location.pathname.indexOf('/order/result') !== -1 ||
      window.location.pathname.indexOf('/order/complete') !== -1) {
    var code = getCookie('affiliate_code');
    if (code) {
      var orderId = document.querySelector('[data-order-id]')?.getAttribute('data-order-id')
                    || getOrderIdFromUrl();
      fetch('https://affiliate-platform-pied-nine.vercel.app/api/webhook/cafe24-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliate_code: code, order_id: orderId, url: window.location.href })
      });
    }
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  function getOrderIdFromUrl() {
    var match = window.location.search.match(/order_id=([^&]+)/);
    return match ? match[1] : null;
  }
})();`;

export async function GET() {
  return new NextResponse(SCRIPT, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
