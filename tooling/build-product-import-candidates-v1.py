import json, re, unicodedata, hashlib
from pathlib import Path
from collections import Counter

ROOT = Path('/mnt/data/lihen-platform')
DATA = ROOT / 'data' / 'catalog-v1'
SRC = json.loads((DATA / 'product-master-reconciliation-manifest.json').read_text(encoding='utf-8'))
TAX = json.loads((DATA / 'taxonomy-canonical-approved-v1.json').read_text(encoding='utf-8'))

# IDs materialized in Supabase DEV by FASE 1.20.3.
BRAND_IDS = {
'Ani-K':'dba9ca71-ba8e-4e1c-bbe0-c71c3e1bbfbb','Anua':'248d2875-a9cb-45f3-850a-d28453541309','Anyeluz':'93f65203-1aaf-405d-9c6d-9e4c46b9b936','Araña':'63bb4a18-52c1-44e1-9d77-023c6cfe8fe7','Atenea':'abf21e50-eeba-4043-994f-673492de30f6','Bloomshell':'e466082b-7532-4204-b781-94650387a81f','Click Hair':'7bcd850b-f2c6-447e-8b80-bb0796deb9df','Cosmos':'0d5fd0dc-2e4c-4e77-bb0a-879997df316d',"D'Luchi":'03a73a7c-1a85-4429-b459-c68ad93c9664','Destiny by La Segura':'340fb06e-fd22-49ec-a967-359e83aa939b','Dr. Althea':'a19f61be-25cd-4387-98da-f75eca7f7973','EOS':'e0e130b8-60d3-4b2d-8fbb-a0329c19adc0','Especianas':'27533ebe-da8e-4e03-8f65-e001fb9418fa','Fem':'c45e4abf-2c47-4465-a5db-87f8731a87cc','Girly':'ee824908-74ce-4709-9eb3-255748302976','Kaba':'23363ac3-3646-47d3-88d8-30b13a62d37d','Karseell':'2a4ff9aa-bf11-4226-819c-90f7f51c2072','La Receta CBD':'57bbddd8-dfe8-44db-b492-158e4a50894b','Leche Pal Pelo':'97dfff9f-d633-42b5-b01b-b5cf608440cf','Lluvia de Estrellas':'149ad838-eb28-4ef2-a9c5-155c7ef29f1d','Madagascar Centella':'78bc4553-2c58-4a9f-9b26-d337c0e29d05','Majikal':'52c89d28-6e86-49d7-838d-1ea3be7c096f','Mariana Zapata':'238d2ca7-8671-467e-8d83-880bf9495def','Medicube':'54f60685-7212-4322-9984-6f5f497916e1','Melu by RubyRose':'d90c6030-d3b7-4536-96bc-388cfe16a805','Milagros':'7d7ace64-4b5a-46ff-99e8-ffe658fe617f','Mixsoon':'6de0dff3-cc20-44ac-ac61-78fa5f30592e','MONTOC':'a4ed69d0-66b1-4abd-9207-5ff729babb58','NABA':'db7a3532-3f9d-4056-a960-cbf98fe3f359','Nube Rosa by Mafe Yepes':'fe7fbce3-260b-44f2-a8a7-0d0f5cfec721','Olé Capilar':'ef713ca9-a46b-46b6-90ea-c100d46fe90f','Ollie':'2503c5f2-51ed-4f1c-b6b3-c7ffe21c6499','Olly':'1d6dae29-08b1-4b89-8569-3e09bd05fe6d','Outdoor Girl':'4ef7e563-2744-446c-804d-7fc5952ec59a','Poción':'21ac02f8-6a51-46be-8f41-daa08b4a770f','Purpure by Angie Bedoya':'ea9d8272-18a7-4af8-8f21-578b65ac5c66','Recomend Professional':'0e9b6e58-d6b5-4a8e-93f2-1c70d76d54f7','Ritual Botánico':'aee464be-85d5-4eca-87d2-084648554252','Rubyskin':'14935694-a7a6-4130-846a-be0565a29c0e','Sense':'9216592a-1e1e-49df-9fb7-2a126fe9bce1','Tocobo':'c56fe8ee-38c2-4559-a243-a27aa01f6cb5','Tratamientos LB SAS':'64b0a568-2007-418f-a691-678d9b4eaca4','Trully':'33759452-ea87-4826-b6d9-19e4821e89e0','Vaseline':'23e8de5f-d5a8-41f0-a3a7-169eaa4eadfc',"Victoria's Secret":'96ca7955-65dc-44ad-9689-3c4cb778480c','Vive Beauty':'f0192f46-e80f-42fb-b788-3c1c8b9aa18c'
}
CATEGORY_IDS = {
'CEPILLOS Y ACCESORIOS PARA EL CABELLO':'b36e2375-b910-4030-abf2-832999885338','ACCESORIOS PARA MAQUILLAJE':'3544b1fc-163e-4fe0-8751-d653d17451f7','CEJAS, PESTAÑAS Y DELINEADORES':'69039ea1-d8d5-4ae9-9dcb-f57b20ec92b7','LABIALES, BRILLOS, DELINEADORES, HIDRATANTES Y TINTAS':'318f08f0-9aa4-4099-a767-9e0ac8298157','BASES, CORRECTORES, POLVOS, RUBORES E ILUMINADORES':'e137169e-b616-4487-aa3e-7637db245219'
}
BRAND_ALIAS = {
'CBD - logo circular (nombre exacto por confirmar)':'La Receta CBD',
"D'L...? - logo caballito de mar (nombre exacto por confirmar)":"D'Luchi",
'M - logo monograma (nombre exacto por confirmar)':'MONTOC',
'Púrpura by Angie Bedoya':'Purpure by Angie Bedoya',
'tratamientoslbsas':'Tratamientos LB SAS',
}

def norm(s):
    if s is None: return None
    s = unicodedata.normalize('NFKD', s).encode('ascii','ignore').decode().lower()
    s = re.sub(r'[^a-z0-9]+',' ',s).strip()
    return re.sub(r'\s+',' ',s)

candidates=[]
for p in SRC:
    raw_brand=p.get('brand')
    canonical_brand=BRAND_ALIAS.get(raw_brand, raw_brand)
    brand_id=BRAND_IDS.get(canonical_brand) if canonical_brand else None
    section=p.get('section')
    category_id=CATEGORY_IDS.get(section) if section else None
    reasons=[]
    status='READY_CANDIDATE'
    if p.get('catalog_audit_review_status') != 'OK':
        status='REVIEW_REQUIRED'
        reasons.append('CATALOG_AUDIT_REVIEW_REQUIRED')
    elif int(p.get('catalog_identity_group_size') or 1) > 1:
        status='CONFLICT'
        reasons.append('DUPLICATE_NORMALIZED_NAME_AND_TAXONOMY_CONTEXT')
    else:
        reasons.append('UNIQUE_CATALOG_IDENTITY_WITH_RESOLVED_TAXONOMY')
    if canonical_brand and not brand_id:
        status='REVIEW_REQUIRED'; reasons.append('BRAND_ID_NOT_RESOLVED')
    if section and not category_id:
        status='REVIEW_REQUIRED'; reasons.append('CATEGORY_ID_NOT_RESOLVED')
    if brand_id:
        reasons.append('BRAND_ID_RESOLVED_FROM_CANONICAL_TAXONOMY')
    if category_id:
        reasons.append('CATEGORY_ID_RESOLVED_FROM_CANONICAL_TAXONOMY')
    if not brand_id and not category_id:
        status='REVIEW_REQUIRED'; reasons.append('NO_TAXONOMY_ANCHOR')

    identity_context = brand_id or category_id or 'NONE'
    identity_key = f"{norm(p['name'])}|{identity_context}"
    candidate={
        'candidate_id': p['reference_id'],
        'source': 'CANONICAL_CATALOG_V1',
        'source_page': p['page'], 'source_slot': p['slot'],
        'product_name': p['name'], 'normalized_name': norm(p['name']),
        'sku': None, 'catalog_code': None,
        'brand_label_original': raw_brand,
        'canonical_brand_name': canonical_brand,
        'brand_id': brand_id,
        'category_label': section,
        'category_id': category_id,
        'sale_price_cop': p['price_cop'],
        'image_sha256': p['image_sha256'],
        'candidate_status': status,
        'proposed_action': 'CREATE_PRODUCT' if status=='READY_CANDIDATE' else 'HOLD_FOR_REVIEW',
        'identity_group_size': p.get('catalog_identity_group_size',1),
        'identity_key': identity_key,
        'catalog_audit_review_status': p.get('catalog_audit_review_status'),
        'catalog_audit_review_reasons': p.get('catalog_audit_review_reasons'),
        'supplier_evidence_status': p.get('supplier_evidence_status'),
        'supplier_evidence': p.get('supplier_evidence',[]),
        'reasons': reasons,
        'auto_insert_allowed': False,
        'review_required': status!='READY_CANDIDATE'
    }
    candidates.append(candidate)

# Integrity checks.
assert len(candidates)==1003
assert all(c['brand_id'] or c['category_id'] for c in candidates)
assert sum(c['brand_id'] is not None for c in candidates)==877
assert sum(c['category_id'] is not None for c in candidates)==126
counts=Counter(c['candidate_status'] for c in candidates)
assert counts == Counter({'READY_CANDIDATE':816,'REVIEW_REQUIRED':113,'CONFLICT':74}), counts

summary={
 'schemaVersion':'1.21.0',
 'strategyVersion':'CANONICAL_TAXONOMY_ANCHORED_CANDIDATES_V1',
 'source':'CANONICAL_CATALOG_V1',
 'totalCandidates':len(candidates),
 'statusCounts':dict(counts),
 'brandIdResolved':sum(c['brand_id'] is not None for c in candidates),
 'categoryIdResolved':sum(c['category_id'] is not None for c in candidates),
 'taxonomyAnchored':sum(bool(c['brand_id'] or c['category_id']) for c in candidates),
 'autoInsertAllowed':0,
 'productsWritten':0,
 'rules':[
   'PRODUCT_CANDIDATE_IS_NOT_PRODUCT',
   'NO_PRODUCT_ROW_IS_INSERTED_IN_PHASE_1_21',
   'BRAND_ID_ONLY_FROM_CANONICAL_BRAND',
   'CATEGORY_ID_ONLY_FROM_EXPLICIT_CANONICAL_CATALOG_SECTION',
   'SUPPLIER_EVIDENCE_IS_AUXILIARY_ONLY',
   'IMAGE_HASH_IS_EVIDENCE_NOT_IDENTITY',
   'DUPLICATE_IDENTITY_REQUIRES_REVIEW',
   'CATALOG_AUDIT_REVIEW_ROWS_REQUIRE_REVIEW',
 ]
}
(DATA/'product-import-candidates-v1.json').write_text(json.dumps(candidates,ensure_ascii=False,indent=2),encoding='utf-8')
(DATA/'product-import-candidates-summary-v1.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False,indent=2))
