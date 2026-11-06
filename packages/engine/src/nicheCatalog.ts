/** Curated starter ideas for the niche picker. A live agent can replace this later. */
export const NICHE_CATEGORIES = ["template", "digital", "tool", "content", "service", "education", "community", "data"] as const;
export type NicheCategory = (typeof NICHE_CATEGORIES)[number];

export interface NicheIdea {
  id: string;
  category: NicheCategory;
  /** 0-100 rough opportunity score; a placeholder judgement, not a measured number. */
  potential: number;
  name: { en: string; vi: string };
  why: { en: string; vi: string };
  /** Trend or signal the idea is based on (only set for AI-generated ideas). */
  trend?: { en: string; vi: string };
}

export const NICHE_IDEAS: readonly NicheIdea[] = [
  {
    "id": "n01",
    "category": "template",
    "potential": 82,
    "name": {
      "en": "Notion freelancer finance tracker with tax set-aside",
      "vi": "Mẫu Notion theo dõi tài chính freelancer, tự trích quỹ thuế"
    },
    "why": {
      "en": "Freelancers hate quarterly tax surprises; templates have near-zero delivery cost.",
      "vi": "Freelancer ngại bất ngờ thuế mỗi quý; mẫu số gần như không tốn chi phí giao hàng."
    }
  },
  {
    "id": "n02",
    "category": "template",
    "potential": 74,
    "name": {
      "en": "Airtable content calendar for solo YouTube creators",
      "vi": "Lịch nội dung Airtable cho YouTuber solo"
    },
    "why": {
      "en": "Creators pay for workflow that saves editing-day chaos; easy to bundle with checklists.",
      "vi": "Nhà sáng tạo trả tiền cho quy trình giảm hỗn loạn ngày dựng video; dễ bán kèm checklist."
    }
  },
  {
    "id": "n03",
    "category": "template",
    "potential": 69,
    "name": {
      "en": "Google Sheets wedding budget planner with vendor payment reminders",
      "vi": "Bảng tính Google lập ngân sách đám cưới có nhắc thanh toán nhà cung cấp"
    },
    "why": {
      "en": "Event buyers search for this yearly; reminders make it stickier than a static sheet.",
      "vi": "Nhu cầu tìm kiếm quanh năm; có nhắc hẹn nên giữ chân tốt hơn bảng tĩnh."
    }
  },
  {
    "id": "n04",
    "category": "digital",
    "potential": 77,
    "name": {
      "en": "Printable ADHD-friendly weekly planners (A4 and US Letter)",
      "vi": "Sổ kế hoạch tuần in được cho người ADHD (A4 và US Letter)"
    },
    "why": {
      "en": "Underserved audience, strong gifting and repeat-buy behavior, print-ready files ship instantly.",
      "vi": "Tệp khách hàng ít được phục vụ, hay mua tặng và mua lại; tệp in sẵn giao ngay."
    }
  },
  {
    "id": "n05",
    "category": "digital",
    "potential": 71,
    "name": {
      "en": "Lightroom preset packs for real-estate listing photos",
      "vi": "Bộ preset Lightroom cho ảnh bất động sản"
    },
    "why": {
      "en": "Agents need fast consistent edits; niche beats generic preset markets.",
      "vi": "Môi giới cần chỉnh ảnh nhanh và đồng nhất; ngách hẹp ít cạnh tranh hơn thị trường preset chung."
    }
  },
  {
    "id": "n06",
    "category": "digital",
    "potential": 66,
    "name": {
      "en": "Procreate brush sets for tattoo flash artists",
      "vi": "Bộ cọ Procreate cho thợ xăm vẽ flash"
    },
    "why": {
      "en": "Passionate buyers, low price sensitivity, clear community channels to reach them.",
      "vi": "Người mua đam mê, ít nhạy cảm về giá, có cộng đồng rõ ràng để tiếp cận."
    }
  },
  {
    "id": "n07",
    "category": "tool",
    "potential": 80,
    "name": {
      "en": "Chrome extension that turns long email threads into action items",
      "vi": "Tiện ích Chrome biến chuỗi email dài thành việc cần làm"
    },
    "why": {
      "en": "Clear daily pain, subscription-friendly, cheap to host with a small model.",
      "vi": "Nỗi đau hằng ngày rõ ràng, hợp mô hình thuê bao, chi phí chạy mô hình nhỏ thấp."
    }
  },
  {
    "id": "n08",
    "category": "tool",
    "potential": 73,
    "name": {
      "en": "Invoice reminder bot for small agencies on WhatsApp",
      "vi": "Bot nhắc hóa đơn qua WhatsApp cho agency nhỏ"
    },
    "why": {
      "en": "Late payments are a top SMB problem; messaging channel gets replies that email does not.",
      "vi": "Thanh toán trễ là vấn đề lớn của doanh nghiệp nhỏ; kênh nhắn tin có phản hồi hơn email."
    }
  },
  {
    "id": "n09",
    "category": "tool",
    "potential": 64,
    "name": {
      "en": "Screenshot-to-spreadsheet converter for receipts and menus",
      "vi": "Công cụ chuyển ảnh chụp hóa đơn và thực đơn thành bảng tính"
    },
    "why": {
      "en": "Simple single-purpose utility with viral demo potential; usage-based pricing fits.",
      "vi": "Tiện ích đơn mục đích, dễ làm video demo lan truyền; hợp tính phí theo lượt dùng."
    }
  },
  {
    "id": "n10",
    "category": "content",
    "potential": 72,
    "name": {
      "en": "Weekly newsletter of vetted remote jobs for junior designers",
      "vi": "Bản tin hằng tuần việc làm từ xa đã kiểm duyệt cho designer mới vào nghề"
    },
    "why": {
      "en": "Sponsorship and paid-listing revenue; audience is specific and easy to reach.",
      "vi": "Doanh thu từ tài trợ và tin tuyển dụng trả phí; đối tượng cụ thể, dễ tiếp cận."
    }
  },
  {
    "id": "n11",
    "category": "content",
    "potential": 65,
    "name": {
      "en": "Faceless short-video channel on cozy productivity for students",
      "vi": "Kênh video ngắn không lộ mặt về năng suất nhẹ nhàng cho sinh viên"
    },
    "why": {
      "en": "Template-driven production keeps costs low; affiliate and digital product upsell.",
      "vi": "Sản xuất theo mẫu nên chi phí thấp; bán thêm affiliate và sản phẩm số."
    }
  },
  {
    "id": "n12",
    "category": "content",
    "potential": 58,
    "name": {
      "en": "Local-language audio guides for lesser-known city walks",
      "vi": "Hướng dẫn âm thanh bằng tiếng địa phương cho các tuyến đi bộ ít người biết"
    },
    "why": {
      "en": "Low competition, evergreen content, partnership potential with hostels and cafes.",
      "vi": "Ít cạnh tranh, nội dung dùng lâu dài, có thể hợp tác với hostel và quán cà phê."
    }
  },
  {
    "id": "n13",
    "category": "service",
    "potential": 70,
    "name": {
      "en": "Done-for-you Shopify product description rewrites in bulk",
      "vi": "Dịch vụ viết lại mô tả sản phẩm Shopify hàng loạt"
    },
    "why": {
      "en": "Clear outcome, per-SKU pricing, scales with AI drafting plus a human pass.",
      "vi": "Kết quả rõ ràng, tính giá theo SKU, mở rộng được nhờ AI viết nháp cộng bước người duyệt."
    }
  },
  {
    "id": "n14",
    "category": "service",
    "potential": 62,
    "name": {
      "en": "Podcast show-notes and clip packages for B2B shows",
      "vi": "Gói ghi chú tập và cắt clip cho podcast B2B"
    },
    "why": {
      "en": "Recurring monthly retainer; buyers value time saved over price.",
      "vi": "Hợp đồng định kỳ hằng tháng; người mua coi trọng thời gian tiết kiệm hơn giá."
    }
  },
  {
    "id": "n15",
    "category": "service",
    "potential": 55,
    "name": {
      "en": "Accessibility audit reports for small ecommerce sites",
      "vi": "Báo cáo kiểm tra khả năng truy cập cho website thương mại điện tử nhỏ"
    },
    "why": {
      "en": "Rising legal pressure creates urgency; fixed-scope reports are easy to deliver.",
      "vi": "Áp lực pháp lý tăng tạo cấp bách; báo cáo phạm vi cố định dễ giao."
    }
  },
  {
    "id": "n16",
    "category": "education",
    "potential": 75,
    "name": {
      "en": "Mini-course: prompt workflows for real-estate agents",
      "vi": "Khóa học ngắn: quy trình prompt cho môi giới bất động sản"
    },
    "why": {
      "en": "Time-boxed outcome for a high-income audience; can be refreshed each model release.",
      "vi": "Kết quả ngắn hạn cho nhóm thu nhập cao; cập nhật được mỗi khi có mô hình mới."
    }
  },
  {
    "id": "n17",
    "category": "education",
    "potential": 67,
    "name": {
      "en": "Excel for nurses: shift, dosage and inventory sheets",
      "vi": "Excel cho điều dưỡng: bảng ca trực, liều thuốc và kho vật tư"
    },
    "why": {
      "en": "Specific profession with real spreadsheet needs and few tailored resources.",
      "vi": "Nghề cụ thể có nhu cầu bảng tính thật nhưng ít tài liệu riêng."
    }
  },
  {
    "id": "n18",
    "category": "education",
    "potential": 60,
    "name": {
      "en": "Interview-practice flashcards for career changers into data analysis",
      "vi": "Thẻ ôn phỏng vấn cho người chuyển nghề sang phân tích dữ liệu"
    },
    "why": {
      "en": "Anxious buyers, clear job-search moment, bundle with a notion tracker.",
      "vi": "Người mua đang lo lắng, đúng thời điểm tìm việc, có thể bán kèm mẫu theo dõi."
    }
  },
  {
    "id": "n19",
    "category": "community",
    "potential": 68,
    "name": {
      "en": "Paid accountability pods for first-time authors",
      "vi": "Nhóm đồng hành trả phí cho tác giả lần đầu"
    },
    "why": {
      "en": "Recurring revenue from small groups; low cost, high retention if matched well.",
      "vi": "Doanh thu định kỳ từ nhóm nhỏ; chi phí thấp, giữ chân cao nếu ghép nhóm tốt."
    }
  },
  {
    "id": "n20",
    "category": "community",
    "potential": 57,
    "name": {
      "en": "Private directory of vetted contractors for expat renters",
      "vi": "Danh bạ kín thợ và dịch vụ đã kiểm chứng cho người nước ngoài thuê nhà"
    },
    "why": {
      "en": "Trust is the product; lead fees and listings monetize it.",
      "vi": "Niềm tin là sản phẩm; phí giới thiệu và đăng tin tạo doanh thu."
    }
  },
  {
    "id": "n21",
    "category": "community",
    "potential": 52,
    "name": {
      "en": "Local board-game meetup subscriptions with venue partners",
      "vi": "Đăng ký sự kiện board game tại địa phương cùng quán đối tác"
    },
    "why": {
      "en": "Offline recurring events, sponsor revenue, slower to scale but sticky.",
      "vi": "Sự kiện offline định kỳ, có tài trợ; mở rộng chậm nhưng giữ chân tốt."
    }
  },
  {
    "id": "n22",
    "category": "data",
    "potential": 73,
    "name": {
      "en": "Monthly price-drop digest for refurbished camera gear",
      "vi": "Bản tin hằng tháng về đợt giảm giá máy ảnh cũ"
    },
    "why": {
      "en": "Affiliate-friendly, easy to automate scraping, enthusiast audience.",
      "vi": "Hợp affiliate, dễ tự động thu thập dữ liệu, tệp người chơi đam mê."
    }
  },
  {
    "id": "n23",
    "category": "data",
    "potential": 63,
    "name": {
      "en": "Grant and funding alerts for small nonprofits",
      "vi": "Cảnh báo cơ hội tài trợ cho tổ chức phi lợi nhuận nhỏ"
    },
    "why": {
      "en": "Time-sensitive deadlines justify a subscription; curated data is hard to copy.",
      "vi": "Hạn chót gấp biện minh cho thuê bao; dữ liệu được tuyển chọn khó sao chép."
    }
  },
  {
    "id": "n24",
    "category": "data",
    "potential": 56,
    "name": {
      "en": "Benchmark dataset of freelance rates by country and skill",
      "vi": "Bộ dữ liệu mức giá freelance theo quốc gia và kỹ năng"
    },
    "why": {
      "en": "One-off report plus yearly refresh; press and community links bring free traffic.",
      "vi": "Báo cáo bán một lần cộng cập nhật hằng năm; báo chí và cộng đồng mang lại lưu lượng miễn phí."
    }
  }
];
