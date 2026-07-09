import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    api_key=os.getenv("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1"
)

# ملحوظة مهمة:
# "openrouter/free" مش اسم موديل ثابت، ده راوتر بيختار موديل مجاني عشوائي
# في كل طلب. عشان كده كانت بتحصل مشاكل خلط لغة (بعض الموديلات
# مبتلتزمش كويس بتعليمة "اتكلمي عربي بس"). المفروض نثبت على موديل
# واحد معروف إنه بيلتزم بالتعليمات كويس ويدعم العربي بشكل جيد.
#
# القايمة بتتغير باستمرار، تأكدي من الموديل ده لسه متاح ومجاني على:
# https://openrouter.ai/models?order=top-weekly  (فلتري بـ Free)
#
# لو الموديل ده اتشال من القايمة المجانية، بدليه بأي موديل تاني
# بنفس الصيغة وحطي :free في الآخر.
MODEL_NAME = "openrouter/free"


def build_system_prompt(prediction_result: dict) -> str:
    predicted_class = prediction_result.get("predicted_class", "غير محدد")
    confidence = prediction_result.get("confidence_score", 0)

    # كان في خطأ هنا: كود البريديكت بيرجع المفتاح "severity_label"
    # مش "severity"، فكانت القيمة دايمًا "غير محدد" والموديل بيرفض
    # يرد على أي سؤال عن الخطورة عشان معندوش المعلومة أصلاً.
    severity = prediction_result.get("severity_label", "غير محدد")

    damage_percentage = prediction_result.get("damage_percentage", 0)
    severity_score = prediction_result.get("severity_score", 0)

    # لو المتريكس التفصيلية موجودة (من analyze_road / analyze_building / analyze_trash)
    # بنضيفها عشان الشات يقدر يرد بتفاصيل أدق لو اليوزر سأل "ليه كده؟"
    metrics = prediction_result.get("metrics", {})
    metrics_lines = ""
    if metrics:
        metrics_lines = "\n".join(
            f"- {key}: {value}" for key, value in metrics.items()
        )

    return f"""
أنتِ مساعد ذكي لنظام "راقب" لإدارة بلاغات مشاكل الطرق والمباني والقمامة، تابع لجهة حكومية.

بيانات البلاغ الحالي (اعتمدي عليها فقط، ولا تخترعي معلومات غير موجودة):
- نوع المشكلة: {predicted_class}
- نسبة ثقة النظام في التصنيف: {confidence}%
- درجة الخطورة: {severity}
- درجة الخطورة الرقمية: {severity_score}
- نسبة الضرر الظاهرة في الصورة: {damage_percentage}%
{("تفاصيل تحليل الصورة:\n" + metrics_lines) if metrics_lines else ""}

تعليمات اللغة (مهم جدًا):
- ردي باللهجة المصرية العامية فقط، وبالعربية 100%
- ممنوع خلط أي كلمات إنجليزية إلا لو كانت مصطلح تقني مفيش له مقابل شائع في العربي
- حتى لو السؤال جالك بالإنجليزي، ردي بالعربي المصري

تعليمات المحتوى:
- أسلوبك ودود ومحترف ومختصر (سطرين لثلاثة كحد أقصى إلا لو طلب المستخدم تفاصيل أكتر)
- لو سُئلتِ عن معلومة غير موجودة في البيانات أعلاه، وضّحي إنها مش متاحة حاليًا بدل ما تخترعيها
- لو درجة الخطورة "High"، أكدي للمستخدم إن البلاغ هياخد أولوية في المعالجة
- لو سُئلتِ عن سبب درجة الخطورة، استخدمي تفاصيل التحليل أعلاه (لو موجودة) عشان تشرحي بشكل مقنع
"""


def get_ai_reply(prediction_result: dict, user_message: str, history: list = None) -> str:
    try:
        system_prompt = build_system_prompt(prediction_result)

        messages = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user_message})

        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            max_tokens=300,
            temperature=0.7,
            extra_headers={
                "HTTP-Referer": "http://localhost:5173",
                "X-Title": "RAQIB Chatbot"
            }
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        import traceback
        print(" خطأ في استدعاء الموديل:")
        traceback.print_exc()
        return "معلش، حصلت مشكلة في الرد. جربي تاني."
