"""Contains all the data models used in inputs/outputs"""

from .batch_generate_mockups_body import BatchGenerateMockupsBody
from .batch_generate_mockups_body_aspect_ratio import BatchGenerateMockupsBodyAspectRatio
from .batch_generate_mockups_body_prompts_item_type_1 import BatchGenerateMockupsBodyPromptsItemType1
from .batch_generate_mockups_body_prompts_item_type_1_base_image import (
    BatchGenerateMockupsBodyPromptsItemType1BaseImage,
)
from .batch_generate_mockups_body_prompts_item_type_1_reference_images_item import (
    BatchGenerateMockupsBodyPromptsItemType1ReferenceImagesItem,
)
from .batch_generate_mockups_body_provider import BatchGenerateMockupsBodyProvider
from .batch_generate_mockups_body_resolution import BatchGenerateMockupsBodyResolution
from .batch_generate_mockups_response_200 import BatchGenerateMockupsResponse200
from .batch_generate_mockups_response_200_content_item import BatchGenerateMockupsResponse200ContentItem
from .batch_generate_mockups_response_200_content_item_type import BatchGenerateMockupsResponse200ContentItemType
from .batch_generate_mockups_response_401 import BatchGenerateMockupsResponse401
from .batch_generate_mockups_response_402 import BatchGenerateMockupsResponse402
from .create_ad_campaign_body import CreateAdCampaignBody
from .create_ad_campaign_body_formats_item import CreateAdCampaignBodyFormatsItem
from .create_ad_campaign_body_model import CreateAdCampaignBodyModel
from .create_ad_campaign_response_200 import CreateAdCampaignResponse200
from .create_ad_campaign_response_200_content_item import CreateAdCampaignResponse200ContentItem
from .create_ad_campaign_response_200_content_item_type import CreateAdCampaignResponse200ContentItemType
from .create_ad_campaign_response_401 import CreateAdCampaignResponse401
from .create_ad_campaign_response_402 import CreateAdCampaignResponse402
from .create_canvas_project_body import CreateCanvasProjectBody
from .create_canvas_project_body_data import CreateCanvasProjectBodyData
from .create_canvas_project_response_200 import CreateCanvasProjectResponse200
from .create_canvas_project_response_200_content_item import CreateCanvasProjectResponse200ContentItem
from .create_canvas_project_response_200_content_item_type import CreateCanvasProjectResponse200ContentItemType
from .create_canvas_project_response_401 import CreateCanvasProjectResponse401
from .create_canvas_project_response_402 import CreateCanvasProjectResponse402
from .create_creative_plan_body import CreateCreativePlanBody
from .create_creative_plan_body_brand_context import CreateCreativePlanBodyBrandContext
from .create_creative_plan_body_format import CreateCreativePlanBodyFormat
from .create_creative_plan_response_200 import CreateCreativePlanResponse200
from .create_creative_plan_response_200_content_item import CreateCreativePlanResponse200ContentItem
from .create_creative_plan_response_200_content_item_type import CreateCreativePlanResponse200ContentItemType
from .create_creative_plan_response_401 import CreateCreativePlanResponse401
from .create_creative_plan_response_402 import CreateCreativePlanResponse402
from .delete_canvas_project_body import DeleteCanvasProjectBody
from .delete_canvas_project_response_200 import DeleteCanvasProjectResponse200
from .delete_canvas_project_response_200_content_item import DeleteCanvasProjectResponse200ContentItem
from .delete_canvas_project_response_200_content_item_type import DeleteCanvasProjectResponse200ContentItemType
from .delete_canvas_project_response_401 import DeleteCanvasProjectResponse401
from .delete_canvas_project_response_402 import DeleteCanvasProjectResponse402
from .delete_mockup_body import DeleteMockupBody
from .delete_mockup_response_200 import DeleteMockupResponse200
from .delete_mockup_response_200_content_item import DeleteMockupResponse200ContentItem
from .delete_mockup_response_200_content_item_type import DeleteMockupResponse200ContentItemType
from .delete_mockup_response_401 import DeleteMockupResponse401
from .delete_mockup_response_402 import DeleteMockupResponse402
from .delete_mockups_id_response_200 import DeleteMockupsIdResponse200
from .document_extract_body import DocumentExtractBody
from .document_extract_body_output import DocumentExtractBodyOutput
from .document_extract_response_200 import DocumentExtractResponse200
from .document_extract_response_200_content_item import DocumentExtractResponse200ContentItem
from .document_extract_response_200_content_item_type import DocumentExtractResponse200ContentItemType
from .document_extract_response_401 import DocumentExtractResponse401
from .document_extract_response_402 import DocumentExtractResponse402
from .extract_colors_body import ExtractColorsBody
from .extract_colors_response_200 import ExtractColorsResponse200
from .extract_colors_response_200_content_item import ExtractColorsResponse200ContentItem
from .extract_colors_response_200_content_item_type import ExtractColorsResponse200ContentItemType
from .extract_colors_response_401 import ExtractColorsResponse401
from .extract_colors_response_402 import ExtractColorsResponse402
from .extract_prompt_from_image_body import ExtractPromptFromImageBody
from .extract_prompt_from_image_response_200 import ExtractPromptFromImageResponse200
from .extract_prompt_from_image_response_200_content_item import ExtractPromptFromImageResponse200ContentItem
from .extract_prompt_from_image_response_200_content_item_type import ExtractPromptFromImageResponse200ContentItemType
from .extract_prompt_from_image_response_401 import ExtractPromptFromImageResponse401
from .extract_prompt_from_image_response_402 import ExtractPromptFromImageResponse402
from .generate_archetype_body import GenerateArchetypeBody
from .generate_archetype_response_200 import GenerateArchetypeResponse200
from .generate_archetype_response_200_content_item import GenerateArchetypeResponse200ContentItem
from .generate_archetype_response_200_content_item_type import GenerateArchetypeResponse200ContentItemType
from .generate_archetype_response_401 import GenerateArchetypeResponse401
from .generate_archetype_response_402 import GenerateArchetypeResponse402
from .generate_color_palettes_body import GenerateColorPalettesBody
from .generate_color_palettes_body_previous_data import GenerateColorPalettesBodyPreviousData
from .generate_color_palettes_response_200 import GenerateColorPalettesResponse200
from .generate_color_palettes_response_200_content_item import GenerateColorPalettesResponse200ContentItem
from .generate_color_palettes_response_200_content_item_type import GenerateColorPalettesResponse200ContentItemType
from .generate_color_palettes_response_401 import GenerateColorPalettesResponse401
from .generate_color_palettes_response_402 import GenerateColorPalettesResponse402
from .generate_concept_ideas_body import GenerateConceptIdeasBody
from .generate_concept_ideas_body_previous_data import GenerateConceptIdeasBodyPreviousData
from .generate_concept_ideas_response_200 import GenerateConceptIdeasResponse200
from .generate_concept_ideas_response_200_content_item import GenerateConceptIdeasResponse200ContentItem
from .generate_concept_ideas_response_200_content_item_type import GenerateConceptIdeasResponse200ContentItemType
from .generate_concept_ideas_response_401 import GenerateConceptIdeasResponse401
from .generate_concept_ideas_response_402 import GenerateConceptIdeasResponse402
from .generate_market_research_body import GenerateMarketResearchBody
from .generate_market_research_response_200 import GenerateMarketResearchResponse200
from .generate_market_research_response_200_content_item import GenerateMarketResearchResponse200ContentItem
from .generate_market_research_response_200_content_item_type import GenerateMarketResearchResponse200ContentItemType
from .generate_market_research_response_401 import GenerateMarketResearchResponse401
from .generate_market_research_response_402 import GenerateMarketResearchResponse402
from .generate_mockup_body import GenerateMockupBody
from .generate_mockup_body_aspect_ratio import GenerateMockupBodyAspectRatio
from .generate_mockup_body_provider import GenerateMockupBodyProvider
from .generate_mockup_body_resolution import GenerateMockupBodyResolution
from .generate_mockup_response_200 import GenerateMockupResponse200
from .generate_mockup_response_200_content_item import GenerateMockupResponse200ContentItem
from .generate_mockup_response_200_content_item_type import GenerateMockupResponse200ContentItemType
from .generate_mockup_response_401 import GenerateMockupResponse401
from .generate_mockup_response_402 import GenerateMockupResponse402
from .generate_moodboard_body import GenerateMoodboardBody
from .generate_moodboard_body_previous_data import GenerateMoodboardBodyPreviousData
from .generate_moodboard_response_200 import GenerateMoodboardResponse200
from .generate_moodboard_response_200_content_item import GenerateMoodboardResponse200ContentItem
from .generate_moodboard_response_200_content_item_type import GenerateMoodboardResponse200ContentItemType
from .generate_moodboard_response_401 import GenerateMoodboardResponse401
from .generate_moodboard_response_402 import GenerateMoodboardResponse402
from .generate_naming_body import GenerateNamingBody
from .generate_naming_response_200 import GenerateNamingResponse200
from .generate_naming_response_200_content_item import GenerateNamingResponse200ContentItem
from .generate_naming_response_200_content_item_type import GenerateNamingResponse200ContentItemType
from .generate_naming_response_401 import GenerateNamingResponse401
from .generate_naming_response_402 import GenerateNamingResponse402
from .generate_persona_body import GeneratePersonaBody
from .generate_persona_response_200 import GeneratePersonaResponse200
from .generate_persona_response_200_content_item import GeneratePersonaResponse200ContentItem
from .generate_persona_response_200_content_item_type import GeneratePersonaResponse200ContentItemType
from .generate_persona_response_401 import GeneratePersonaResponse401
from .generate_persona_response_402 import GeneratePersonaResponse402
from .generate_smart_prompt_body import GenerateSmartPromptBody
from .generate_smart_prompt_body_aspect_ratio import GenerateSmartPromptBodyAspectRatio
from .generate_smart_prompt_response_200 import GenerateSmartPromptResponse200
from .generate_smart_prompt_response_200_content_item import GenerateSmartPromptResponse200ContentItem
from .generate_smart_prompt_response_200_content_item_type import GenerateSmartPromptResponse200ContentItemType
from .generate_smart_prompt_response_401 import GenerateSmartPromptResponse401
from .generate_smart_prompt_response_402 import GenerateSmartPromptResponse402
from .generate_swot_body import GenerateSwotBody
from .generate_swot_body_previous_data import GenerateSwotBodyPreviousData
from .generate_swot_response_200 import GenerateSwotResponse200
from .generate_swot_response_200_content_item import GenerateSwotResponse200ContentItem
from .generate_swot_response_200_content_item_type import GenerateSwotResponse200ContentItemType
from .generate_swot_response_401 import GenerateSwotResponse401
from .generate_swot_response_402 import GenerateSwotResponse402
from .get_auth_profile_response_200 import GetAuthProfileResponse200
from .get_brand_design_system_body import GetBrandDesignSystemBody
from .get_brand_design_system_response_200 import GetBrandDesignSystemResponse200
from .get_brand_design_system_response_200_content_item import GetBrandDesignSystemResponse200ContentItem
from .get_brand_design_system_response_200_content_item_type import GetBrandDesignSystemResponse200ContentItemType
from .get_brand_design_system_response_401 import GetBrandDesignSystemResponse401
from .get_brand_design_system_response_402 import GetBrandDesignSystemResponse402
from .get_brand_guideline_body import GetBrandGuidelineBody
from .get_brand_guideline_response_200 import GetBrandGuidelineResponse200
from .get_brand_guideline_response_200_content_item import GetBrandGuidelineResponse200ContentItem
from .get_brand_guideline_response_200_content_item_type import GetBrandGuidelineResponse200ContentItemType
from .get_brand_guideline_response_401 import GetBrandGuidelineResponse401
from .get_brand_guideline_response_402 import GetBrandGuidelineResponse402
from .get_brand_guidelines_public_slug_context_response_404 import GetBrandGuidelinesPublicSlugContextResponse404
from .get_brand_guidelines_public_slug_response_404 import GetBrandGuidelinesPublicSlugResponse404
from .get_brand_insights_body import GetBrandInsightsBody
from .get_brand_insights_response_200 import GetBrandInsightsResponse200
from .get_brand_insights_response_200_content_item import GetBrandInsightsResponse200ContentItem
from .get_brand_insights_response_200_content_item_type import GetBrandInsightsResponse200ContentItemType
from .get_brand_insights_response_401 import GetBrandInsightsResponse401
from .get_brand_insights_response_402 import GetBrandInsightsResponse402
from .get_campaign_results_body import GetCampaignResultsBody
from .get_campaign_results_response_200 import GetCampaignResultsResponse200
from .get_campaign_results_response_200_content_item import GetCampaignResultsResponse200ContentItem
from .get_campaign_results_response_200_content_item_type import GetCampaignResultsResponse200ContentItemType
from .get_campaign_results_response_401 import GetCampaignResultsResponse401
from .get_campaign_results_response_402 import GetCampaignResultsResponse402
from .get_canvas_project_body import GetCanvasProjectBody
from .get_canvas_project_response_200 import GetCanvasProjectResponse200
from .get_canvas_project_response_200_content_item import GetCanvasProjectResponse200ContentItem
from .get_canvas_project_response_200_content_item_type import GetCanvasProjectResponse200ContentItemType
from .get_canvas_project_response_401 import GetCanvasProjectResponse401
from .get_canvas_project_response_402 import GetCanvasProjectResponse402
from .get_creative_metrics_body import GetCreativeMetricsBody
from .get_creative_metrics_response_200 import GetCreativeMetricsResponse200
from .get_creative_metrics_response_200_content_item import GetCreativeMetricsResponse200ContentItem
from .get_creative_metrics_response_200_content_item_type import GetCreativeMetricsResponse200ContentItemType
from .get_creative_metrics_response_401 import GetCreativeMetricsResponse401
from .get_creative_metrics_response_402 import GetCreativeMetricsResponse402
from .get_mockup_body import GetMockupBody
from .get_mockup_response_200 import GetMockupResponse200
from .get_mockup_response_200_content_item import GetMockupResponse200ContentItem
from .get_mockup_response_200_content_item_type import GetMockupResponse200ContentItemType
from .get_mockup_response_401 import GetMockupResponse401
from .get_mockup_response_402 import GetMockupResponse402
from .get_mockup_usage_stats_body import GetMockupUsageStatsBody
from .get_mockup_usage_stats_response_200 import GetMockupUsageStatsResponse200
from .get_mockup_usage_stats_response_200_content_item import GetMockupUsageStatsResponse200ContentItem
from .get_mockup_usage_stats_response_200_content_item_type import GetMockupUsageStatsResponse200ContentItemType
from .get_mockup_usage_stats_response_401 import GetMockupUsageStatsResponse401
from .get_mockup_usage_stats_response_402 import GetMockupUsageStatsResponse402
from .get_mockups_id_response_200 import GetMockupsIdResponse200
from .get_mockups_id_response_404 import GetMockupsIdResponse404
from .get_plugin_docs_response_200 import GetPluginDocsResponse200
from .get_plugin_mcp_response_200 import GetPluginMcpResponse200
from .improve_prompt_body import ImprovePromptBody
from .improve_prompt_response_200 import ImprovePromptResponse200
from .improve_prompt_response_200_content_item import ImprovePromptResponse200ContentItem
from .improve_prompt_response_200_content_item_type import ImprovePromptResponse200ContentItemType
from .improve_prompt_response_401 import ImprovePromptResponse401
from .improve_prompt_response_402 import ImprovePromptResponse402
from .list_brand_guidelines_body import ListBrandGuidelinesBody
from .list_brand_guidelines_response_200 import ListBrandGuidelinesResponse200
from .list_brand_guidelines_response_200_content_item import ListBrandGuidelinesResponse200ContentItem
from .list_brand_guidelines_response_200_content_item_type import ListBrandGuidelinesResponse200ContentItemType
from .list_brand_guidelines_response_401 import ListBrandGuidelinesResponse401
from .list_brand_guidelines_response_402 import ListBrandGuidelinesResponse402
from .list_canvas_projects_body import ListCanvasProjectsBody
from .list_canvas_projects_response_200 import ListCanvasProjectsResponse200
from .list_canvas_projects_response_200_content_item import ListCanvasProjectsResponse200ContentItem
from .list_canvas_projects_response_200_content_item_type import ListCanvasProjectsResponse200ContentItemType
from .list_canvas_projects_response_401 import ListCanvasProjectsResponse401
from .list_canvas_projects_response_402 import ListCanvasProjectsResponse402
from .list_creative_events_body import ListCreativeEventsBody
from .list_creative_events_response_200 import ListCreativeEventsResponse200
from .list_creative_events_response_200_content_item import ListCreativeEventsResponse200ContentItem
from .list_creative_events_response_200_content_item_type import ListCreativeEventsResponse200ContentItemType
from .list_creative_events_response_401 import ListCreativeEventsResponse401
from .list_creative_events_response_402 import ListCreativeEventsResponse402
from .list_mockups_body import ListMockupsBody
from .list_mockups_response_200 import ListMockupsResponse200
from .list_mockups_response_200_content_item import ListMockupsResponse200ContentItem
from .list_mockups_response_200_content_item_type import ListMockupsResponse200ContentItemType
from .list_mockups_response_401 import ListMockupsResponse401
from .list_mockups_response_402 import ListMockupsResponse402
from .list_public_mockups_body import ListPublicMockupsBody
from .list_public_mockups_response_200 import ListPublicMockupsResponse200
from .list_public_mockups_response_200_content_item import ListPublicMockupsResponse200ContentItem
from .list_public_mockups_response_200_content_item_type import ListPublicMockupsResponse200ContentItemType
from .list_public_mockups_response_401 import ListPublicMockupsResponse401
from .list_public_mockups_response_402 import ListPublicMockupsResponse402
from .post_ai_describe_image_body import PostAiDescribeImageBody
from .post_ai_describe_image_body_image import PostAiDescribeImageBodyImage
from .post_ai_describe_image_response_200 import PostAiDescribeImageResponse200
from .post_ai_extract_colors_body import PostAiExtractColorsBody
from .post_ai_extract_colors_body_image import PostAiExtractColorsBodyImage
from .post_ai_extract_colors_response_200 import PostAiExtractColorsResponse200
from .post_ai_extract_colors_response_200_colors_item import PostAiExtractColorsResponse200ColorsItem
from .post_ai_extract_colors_response_200_colors_item_frequency import PostAiExtractColorsResponse200ColorsItemFrequency
from .post_ai_extract_colors_response_200_colors_item_role import PostAiExtractColorsResponse200ColorsItemRole
from .post_ai_generate_naming_body import PostAiGenerateNamingBody
from .post_ai_generate_naming_response_200 import PostAiGenerateNamingResponse200
from .post_ai_generate_naming_response_200_names_item import PostAiGenerateNamingResponse200NamesItem
from .post_ai_generate_smart_prompt_body import PostAiGenerateSmartPromptBody
from .post_ai_generate_smart_prompt_body_aspect_ratio import PostAiGenerateSmartPromptBodyAspectRatio
from .post_ai_generate_smart_prompt_response_200 import PostAiGenerateSmartPromptResponse200
from .post_ai_improve_prompt_body import PostAiImprovePromptBody
from .post_ai_improve_prompt_response_200 import PostAiImprovePromptResponse200
from .post_ai_suggest_prompt_variations_body import PostAiSuggestPromptVariationsBody
from .post_ai_suggest_prompt_variations_response_200 import PostAiSuggestPromptVariationsResponse200
from .post_auth_login_body import PostAuthLoginBody
from .post_auth_login_response_200 import PostAuthLoginResponse200
from .post_auth_login_response_401 import PostAuthLoginResponse401
from .post_auth_logout_response_200 import PostAuthLogoutResponse200
from .post_auth_refresh_body import PostAuthRefreshBody
from .post_auth_refresh_response_200 import PostAuthRefreshResponse200
from .post_auth_signup_body import PostAuthSignupBody
from .post_auth_signup_response_201 import PostAuthSignupResponse201
from .post_auth_signup_response_400 import PostAuthSignupResponse400
from .post_auth_verify_email_body import PostAuthVerifyEmailBody
from .post_auth_verify_email_response_200 import PostAuthVerifyEmailResponse200
from .post_branding_generate_step_body import PostBrandingGenerateStepBody
from .post_branding_generate_step_body_previous_data import PostBrandingGenerateStepBodyPreviousData
from .post_branding_generate_step_body_step import PostBrandingGenerateStepBodyStep
from .post_branding_generate_step_response_200 import PostBrandingGenerateStepResponse200
from .post_branding_generate_step_response_200_result import PostBrandingGenerateStepResponse200Result
from .post_branding_generate_step_response_402 import PostBrandingGenerateStepResponse402
from .post_mockups_batch_generate_body import PostMockupsBatchGenerateBody
from .post_mockups_batch_generate_body_aspect_ratio import PostMockupsBatchGenerateBodyAspectRatio
from .post_mockups_batch_generate_body_base_image import PostMockupsBatchGenerateBodyBaseImage
from .post_mockups_batch_generate_body_provider import PostMockupsBatchGenerateBodyProvider
from .post_mockups_batch_generate_body_resolution import PostMockupsBatchGenerateBodyResolution
from .post_mockups_batch_generate_response_200 import PostMockupsBatchGenerateResponse200
from .post_mockups_batch_generate_response_200_results_item import PostMockupsBatchGenerateResponse200ResultsItem
from .post_mockups_batch_generate_response_200_results_item_data import (
    PostMockupsBatchGenerateResponse200ResultsItemData,
)
from .post_mockups_generate_body import PostMockupsGenerateBody
from .post_mockups_generate_body_model import PostMockupsGenerateBodyModel
from .post_mockups_generate_body_provider import PostMockupsGenerateBodyProvider
from .post_mockups_generate_body_resolution import PostMockupsGenerateBodyResolution
from .post_mockups_generate_response_200 import PostMockupsGenerateResponse200
from .post_mockups_generate_response_400 import PostMockupsGenerateResponse400
from .post_plugin_body import PostPluginBody
from .post_plugin_response_200 import PostPluginResponse200
from .put_auth_profile_body import PutAuthProfileBody
from .put_auth_profile_response_200 import PutAuthProfileResponse200
from .put_mockups_id_body import PutMockupsIdBody
from .put_mockups_id_response_200 import PutMockupsIdResponse200
from .suggest_prompt_variations_body import SuggestPromptVariationsBody
from .suggest_prompt_variations_response_200 import SuggestPromptVariationsResponse200
from .suggest_prompt_variations_response_200_content_item import SuggestPromptVariationsResponse200ContentItem
from .suggest_prompt_variations_response_200_content_item_type import SuggestPromptVariationsResponse200ContentItemType
from .suggest_prompt_variations_response_401 import SuggestPromptVariationsResponse401
from .suggest_prompt_variations_response_402 import SuggestPromptVariationsResponse402
from .update_brand_guideline_response_200 import UpdateBrandGuidelineResponse200
from .update_brand_guideline_response_200_content_item import UpdateBrandGuidelineResponse200ContentItem
from .update_brand_guideline_response_200_content_item_type import UpdateBrandGuidelineResponse200ContentItemType
from .update_brand_guideline_response_401 import UpdateBrandGuidelineResponse401
from .update_brand_guideline_response_402 import UpdateBrandGuidelineResponse402
from .update_canvas_project_body import UpdateCanvasProjectBody
from .update_canvas_project_body_data import UpdateCanvasProjectBodyData
from .update_canvas_project_response_200 import UpdateCanvasProjectResponse200
from .update_canvas_project_response_200_content_item import UpdateCanvasProjectResponse200ContentItem
from .update_canvas_project_response_200_content_item_type import UpdateCanvasProjectResponse200ContentItemType
from .update_canvas_project_response_401 import UpdateCanvasProjectResponse401
from .update_canvas_project_response_402 import UpdateCanvasProjectResponse402
from .validate_brand_section_body import ValidateBrandSectionBody
from .validate_brand_section_body_state import ValidateBrandSectionBodyState
from .validate_brand_section_response_200 import ValidateBrandSectionResponse200
from .validate_brand_section_response_200_content_item import ValidateBrandSectionResponse200ContentItem
from .validate_brand_section_response_200_content_item_type import ValidateBrandSectionResponse200ContentItemType
from .validate_brand_section_response_401 import ValidateBrandSectionResponse401
from .validate_brand_section_response_402 import ValidateBrandSectionResponse402

__all__ = (
    "BatchGenerateMockupsBody",
    "BatchGenerateMockupsBodyAspectRatio",
    "BatchGenerateMockupsBodyPromptsItemType1",
    "BatchGenerateMockupsBodyPromptsItemType1BaseImage",
    "BatchGenerateMockupsBodyPromptsItemType1ReferenceImagesItem",
    "BatchGenerateMockupsBodyProvider",
    "BatchGenerateMockupsBodyResolution",
    "BatchGenerateMockupsResponse200",
    "BatchGenerateMockupsResponse200ContentItem",
    "BatchGenerateMockupsResponse200ContentItemType",
    "BatchGenerateMockupsResponse401",
    "BatchGenerateMockupsResponse402",
    "CreateAdCampaignBody",
    "CreateAdCampaignBodyFormatsItem",
    "CreateAdCampaignBodyModel",
    "CreateAdCampaignResponse200",
    "CreateAdCampaignResponse200ContentItem",
    "CreateAdCampaignResponse200ContentItemType",
    "CreateAdCampaignResponse401",
    "CreateAdCampaignResponse402",
    "CreateCanvasProjectBody",
    "CreateCanvasProjectBodyData",
    "CreateCanvasProjectResponse200",
    "CreateCanvasProjectResponse200ContentItem",
    "CreateCanvasProjectResponse200ContentItemType",
    "CreateCanvasProjectResponse401",
    "CreateCanvasProjectResponse402",
    "CreateCreativePlanBody",
    "CreateCreativePlanBodyBrandContext",
    "CreateCreativePlanBodyFormat",
    "CreateCreativePlanResponse200",
    "CreateCreativePlanResponse200ContentItem",
    "CreateCreativePlanResponse200ContentItemType",
    "CreateCreativePlanResponse401",
    "CreateCreativePlanResponse402",
    "DeleteCanvasProjectBody",
    "DeleteCanvasProjectResponse200",
    "DeleteCanvasProjectResponse200ContentItem",
    "DeleteCanvasProjectResponse200ContentItemType",
    "DeleteCanvasProjectResponse401",
    "DeleteCanvasProjectResponse402",
    "DeleteMockupBody",
    "DeleteMockupResponse200",
    "DeleteMockupResponse200ContentItem",
    "DeleteMockupResponse200ContentItemType",
    "DeleteMockupResponse401",
    "DeleteMockupResponse402",
    "DeleteMockupsIdResponse200",
    "DocumentExtractBody",
    "DocumentExtractBodyOutput",
    "DocumentExtractResponse200",
    "DocumentExtractResponse200ContentItem",
    "DocumentExtractResponse200ContentItemType",
    "DocumentExtractResponse401",
    "DocumentExtractResponse402",
    "ExtractColorsBody",
    "ExtractColorsResponse200",
    "ExtractColorsResponse200ContentItem",
    "ExtractColorsResponse200ContentItemType",
    "ExtractColorsResponse401",
    "ExtractColorsResponse402",
    "ExtractPromptFromImageBody",
    "ExtractPromptFromImageResponse200",
    "ExtractPromptFromImageResponse200ContentItem",
    "ExtractPromptFromImageResponse200ContentItemType",
    "ExtractPromptFromImageResponse401",
    "ExtractPromptFromImageResponse402",
    "GenerateArchetypeBody",
    "GenerateArchetypeResponse200",
    "GenerateArchetypeResponse200ContentItem",
    "GenerateArchetypeResponse200ContentItemType",
    "GenerateArchetypeResponse401",
    "GenerateArchetypeResponse402",
    "GenerateColorPalettesBody",
    "GenerateColorPalettesBodyPreviousData",
    "GenerateColorPalettesResponse200",
    "GenerateColorPalettesResponse200ContentItem",
    "GenerateColorPalettesResponse200ContentItemType",
    "GenerateColorPalettesResponse401",
    "GenerateColorPalettesResponse402",
    "GenerateConceptIdeasBody",
    "GenerateConceptIdeasBodyPreviousData",
    "GenerateConceptIdeasResponse200",
    "GenerateConceptIdeasResponse200ContentItem",
    "GenerateConceptIdeasResponse200ContentItemType",
    "GenerateConceptIdeasResponse401",
    "GenerateConceptIdeasResponse402",
    "GenerateMarketResearchBody",
    "GenerateMarketResearchResponse200",
    "GenerateMarketResearchResponse200ContentItem",
    "GenerateMarketResearchResponse200ContentItemType",
    "GenerateMarketResearchResponse401",
    "GenerateMarketResearchResponse402",
    "GenerateMockupBody",
    "GenerateMockupBodyAspectRatio",
    "GenerateMockupBodyProvider",
    "GenerateMockupBodyResolution",
    "GenerateMockupResponse200",
    "GenerateMockupResponse200ContentItem",
    "GenerateMockupResponse200ContentItemType",
    "GenerateMockupResponse401",
    "GenerateMockupResponse402",
    "GenerateMoodboardBody",
    "GenerateMoodboardBodyPreviousData",
    "GenerateMoodboardResponse200",
    "GenerateMoodboardResponse200ContentItem",
    "GenerateMoodboardResponse200ContentItemType",
    "GenerateMoodboardResponse401",
    "GenerateMoodboardResponse402",
    "GenerateNamingBody",
    "GenerateNamingResponse200",
    "GenerateNamingResponse200ContentItem",
    "GenerateNamingResponse200ContentItemType",
    "GenerateNamingResponse401",
    "GenerateNamingResponse402",
    "GeneratePersonaBody",
    "GeneratePersonaResponse200",
    "GeneratePersonaResponse200ContentItem",
    "GeneratePersonaResponse200ContentItemType",
    "GeneratePersonaResponse401",
    "GeneratePersonaResponse402",
    "GenerateSmartPromptBody",
    "GenerateSmartPromptBodyAspectRatio",
    "GenerateSmartPromptResponse200",
    "GenerateSmartPromptResponse200ContentItem",
    "GenerateSmartPromptResponse200ContentItemType",
    "GenerateSmartPromptResponse401",
    "GenerateSmartPromptResponse402",
    "GenerateSwotBody",
    "GenerateSwotBodyPreviousData",
    "GenerateSwotResponse200",
    "GenerateSwotResponse200ContentItem",
    "GenerateSwotResponse200ContentItemType",
    "GenerateSwotResponse401",
    "GenerateSwotResponse402",
    "GetAuthProfileResponse200",
    "GetBrandDesignSystemBody",
    "GetBrandDesignSystemResponse200",
    "GetBrandDesignSystemResponse200ContentItem",
    "GetBrandDesignSystemResponse200ContentItemType",
    "GetBrandDesignSystemResponse401",
    "GetBrandDesignSystemResponse402",
    "GetBrandGuidelineBody",
    "GetBrandGuidelineResponse200",
    "GetBrandGuidelineResponse200ContentItem",
    "GetBrandGuidelineResponse200ContentItemType",
    "GetBrandGuidelineResponse401",
    "GetBrandGuidelineResponse402",
    "GetBrandGuidelinesPublicSlugContextResponse404",
    "GetBrandGuidelinesPublicSlugResponse404",
    "GetBrandInsightsBody",
    "GetBrandInsightsResponse200",
    "GetBrandInsightsResponse200ContentItem",
    "GetBrandInsightsResponse200ContentItemType",
    "GetBrandInsightsResponse401",
    "GetBrandInsightsResponse402",
    "GetCampaignResultsBody",
    "GetCampaignResultsResponse200",
    "GetCampaignResultsResponse200ContentItem",
    "GetCampaignResultsResponse200ContentItemType",
    "GetCampaignResultsResponse401",
    "GetCampaignResultsResponse402",
    "GetCanvasProjectBody",
    "GetCanvasProjectResponse200",
    "GetCanvasProjectResponse200ContentItem",
    "GetCanvasProjectResponse200ContentItemType",
    "GetCanvasProjectResponse401",
    "GetCanvasProjectResponse402",
    "GetCreativeMetricsBody",
    "GetCreativeMetricsResponse200",
    "GetCreativeMetricsResponse200ContentItem",
    "GetCreativeMetricsResponse200ContentItemType",
    "GetCreativeMetricsResponse401",
    "GetCreativeMetricsResponse402",
    "GetMockupBody",
    "GetMockupResponse200",
    "GetMockupResponse200ContentItem",
    "GetMockupResponse200ContentItemType",
    "GetMockupResponse401",
    "GetMockupResponse402",
    "GetMockupsIdResponse200",
    "GetMockupsIdResponse404",
    "GetMockupUsageStatsBody",
    "GetMockupUsageStatsResponse200",
    "GetMockupUsageStatsResponse200ContentItem",
    "GetMockupUsageStatsResponse200ContentItemType",
    "GetMockupUsageStatsResponse401",
    "GetMockupUsageStatsResponse402",
    "GetPluginDocsResponse200",
    "GetPluginMcpResponse200",
    "ImprovePromptBody",
    "ImprovePromptResponse200",
    "ImprovePromptResponse200ContentItem",
    "ImprovePromptResponse200ContentItemType",
    "ImprovePromptResponse401",
    "ImprovePromptResponse402",
    "ListBrandGuidelinesBody",
    "ListBrandGuidelinesResponse200",
    "ListBrandGuidelinesResponse200ContentItem",
    "ListBrandGuidelinesResponse200ContentItemType",
    "ListBrandGuidelinesResponse401",
    "ListBrandGuidelinesResponse402",
    "ListCanvasProjectsBody",
    "ListCanvasProjectsResponse200",
    "ListCanvasProjectsResponse200ContentItem",
    "ListCanvasProjectsResponse200ContentItemType",
    "ListCanvasProjectsResponse401",
    "ListCanvasProjectsResponse402",
    "ListCreativeEventsBody",
    "ListCreativeEventsResponse200",
    "ListCreativeEventsResponse200ContentItem",
    "ListCreativeEventsResponse200ContentItemType",
    "ListCreativeEventsResponse401",
    "ListCreativeEventsResponse402",
    "ListMockupsBody",
    "ListMockupsResponse200",
    "ListMockupsResponse200ContentItem",
    "ListMockupsResponse200ContentItemType",
    "ListMockupsResponse401",
    "ListMockupsResponse402",
    "ListPublicMockupsBody",
    "ListPublicMockupsResponse200",
    "ListPublicMockupsResponse200ContentItem",
    "ListPublicMockupsResponse200ContentItemType",
    "ListPublicMockupsResponse401",
    "ListPublicMockupsResponse402",
    "PostAiDescribeImageBody",
    "PostAiDescribeImageBodyImage",
    "PostAiDescribeImageResponse200",
    "PostAiExtractColorsBody",
    "PostAiExtractColorsBodyImage",
    "PostAiExtractColorsResponse200",
    "PostAiExtractColorsResponse200ColorsItem",
    "PostAiExtractColorsResponse200ColorsItemFrequency",
    "PostAiExtractColorsResponse200ColorsItemRole",
    "PostAiGenerateNamingBody",
    "PostAiGenerateNamingResponse200",
    "PostAiGenerateNamingResponse200NamesItem",
    "PostAiGenerateSmartPromptBody",
    "PostAiGenerateSmartPromptBodyAspectRatio",
    "PostAiGenerateSmartPromptResponse200",
    "PostAiImprovePromptBody",
    "PostAiImprovePromptResponse200",
    "PostAiSuggestPromptVariationsBody",
    "PostAiSuggestPromptVariationsResponse200",
    "PostAuthLoginBody",
    "PostAuthLoginResponse200",
    "PostAuthLoginResponse401",
    "PostAuthLogoutResponse200",
    "PostAuthRefreshBody",
    "PostAuthRefreshResponse200",
    "PostAuthSignupBody",
    "PostAuthSignupResponse201",
    "PostAuthSignupResponse400",
    "PostAuthVerifyEmailBody",
    "PostAuthVerifyEmailResponse200",
    "PostBrandingGenerateStepBody",
    "PostBrandingGenerateStepBodyPreviousData",
    "PostBrandingGenerateStepBodyStep",
    "PostBrandingGenerateStepResponse200",
    "PostBrandingGenerateStepResponse200Result",
    "PostBrandingGenerateStepResponse402",
    "PostMockupsBatchGenerateBody",
    "PostMockupsBatchGenerateBodyAspectRatio",
    "PostMockupsBatchGenerateBodyBaseImage",
    "PostMockupsBatchGenerateBodyProvider",
    "PostMockupsBatchGenerateBodyResolution",
    "PostMockupsBatchGenerateResponse200",
    "PostMockupsBatchGenerateResponse200ResultsItem",
    "PostMockupsBatchGenerateResponse200ResultsItemData",
    "PostMockupsGenerateBody",
    "PostMockupsGenerateBodyModel",
    "PostMockupsGenerateBodyProvider",
    "PostMockupsGenerateBodyResolution",
    "PostMockupsGenerateResponse200",
    "PostMockupsGenerateResponse400",
    "PostPluginBody",
    "PostPluginResponse200",
    "PutAuthProfileBody",
    "PutAuthProfileResponse200",
    "PutMockupsIdBody",
    "PutMockupsIdResponse200",
    "SuggestPromptVariationsBody",
    "SuggestPromptVariationsResponse200",
    "SuggestPromptVariationsResponse200ContentItem",
    "SuggestPromptVariationsResponse200ContentItemType",
    "SuggestPromptVariationsResponse401",
    "SuggestPromptVariationsResponse402",
    "UpdateBrandGuidelineResponse200",
    "UpdateBrandGuidelineResponse200ContentItem",
    "UpdateBrandGuidelineResponse200ContentItemType",
    "UpdateBrandGuidelineResponse401",
    "UpdateBrandGuidelineResponse402",
    "UpdateCanvasProjectBody",
    "UpdateCanvasProjectBodyData",
    "UpdateCanvasProjectResponse200",
    "UpdateCanvasProjectResponse200ContentItem",
    "UpdateCanvasProjectResponse200ContentItemType",
    "UpdateCanvasProjectResponse401",
    "UpdateCanvasProjectResponse402",
    "ValidateBrandSectionBody",
    "ValidateBrandSectionBodyState",
    "ValidateBrandSectionResponse200",
    "ValidateBrandSectionResponse200ContentItem",
    "ValidateBrandSectionResponse200ContentItemType",
    "ValidateBrandSectionResponse401",
    "ValidateBrandSectionResponse402",
)
