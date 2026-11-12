from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
import openai
import os
import logging
import random
import json

logger = logging.getLogger(__name__)

# Climate-related keywords for content filtering
CLIMATE_KEYWORDS = [
    'climate', 'environment', 'sustainability', 'green', 'eco', 'carbon', 'emission',
    'renewable', 'solar', 'wind', 'energy', 'conservation', 'biodiversity', 'pollution',
    'global warming', 'greenhouse', 'deforestation', 'recycling', 'waste', 'water',
    'ocean', 'forest', 'wildlife', 'nature', 'earth', 'planet', 'future'
]

# Bad words filter (basic list)
BAD_WORDS = [
    'hate', 'violence', 'abuse', 'spam', 'scam', 'fake', 'fraud'
]

def get_openai_client():
    """Get OpenAI client with error handling"""
    try:
        # Temporarily disable OpenAI client due to persistent proxies error
        # This is a workaround until the environment is properly configured
        logger.warning("OpenAI client disabled due to persistent proxies parameter error")
        return None
        
        # Original code (commented out due to error):
        # api_key = os.getenv('OPENAI_API_KEY')
        # if not api_key:
        #     logger.warning("OPENAI_API_KEY not found in environment variables")
        #     return None
        # 
        # # Clear any proxy environment variables that might cause issues
        # import os
        # for key in ['HTTP_PROXY', 'HTTPS_PROXY', 'PROXIES']:
        #     if key in os.environ:
        #         del os.environ[key]
        # 
        # return openai.OpenAI(api_key=api_key)
        
    except Exception as e:
        logger.error(f"Error creating OpenAI client: {e}")
        return None

def generate_fallback_content(topic, content_type):
    """Generate fallback content when OpenAI is not available"""
    climate_topics = [
        "climate action", "sustainability", "environmental protection", 
        "renewable energy", "carbon reduction", "green living"
    ]
    
    content_templates = {
        'social_media_post': [
            f"🌱 Let's take action for {topic}! Every small step towards sustainability matters. Together, we can make a difference for our planet. #ClimateAction #Sustainability #Environment",
            f"💚 The future of our planet depends on the choices we make today. Join the movement for {topic} and be part of the solution! #GreenFuture #EcoFriendly #ClimateChange",
            f"🌍 Small actions, big impact! Let's work together for {topic} and create a sustainable future for generations to come. #SustainableLiving #ClimateAction #Environment",
            f"🌿 Every day is Earth Day when we prioritize {topic}. Let's protect our planet through conscious choices and sustainable practices! #EarthDay #Sustainability #GreenLiving",
            f"⚡ Renewable energy and {topic} go hand in hand. Let's accelerate the transition to a cleaner, greener future! #RenewableEnergy #ClimateAction #Sustainability"
        ],
        'article': [
            f"Understanding the importance of {topic} in today's world is crucial for environmental sustainability. This comprehensive guide explores the key aspects and actionable steps we can take.",
            f"The role of {topic} in combating climate change cannot be overstated. From individual actions to collective efforts, every contribution matters in our fight for a sustainable future.",
            f"Exploring innovative solutions for {topic} reveals the potential for positive environmental impact. Through research, technology, and community engagement, we can achieve meaningful change."
        ],
        'campaign': [
            f"Join our campaign for {topic}! Together, we can create a movement that drives real change and builds a sustainable future for all.",
            f"Be part of the solution! Our {topic} campaign brings together individuals, communities, and organizations to make a lasting environmental impact.",
            f"Take action now! The {topic} campaign is your opportunity to contribute to meaningful environmental change and help protect our planet."
        ]
    }
    
    template_type = content_type if content_type in content_templates else 'social_media_post'
    templates = content_templates[template_type]
    
    return random.choice(templates)

def generate_fallback_hashtags(topic):
    """Generate fallback hashtags when OpenAI is not available"""
    base_hashtags = [
        "#ClimateAction", "#Sustainability", "#Environment", "#GreenLiving", 
        "#EcoFriendly", "#ClimateChange", "#RenewableEnergy", "#GreenFuture",
        "#SustainableLiving", "#EarthDay", "#ClimateCrisis", "#GreenTech"
    ]
    
    topic_hashtags = []
    if 'climate' in topic.lower():
        topic_hashtags.extend(["#ClimateAction", "#ClimateChange", "#ClimateCrisis"])
    if 'sustainability' in topic.lower():
        topic_hashtags.extend(["#Sustainability", "#SustainableLiving", "#GreenLiving"])
    if 'environment' in topic.lower():
        topic_hashtags.extend(["#Environment", "#EnvironmentalProtection", "#EcoFriendly"])
    if 'energy' in topic.lower():
        topic_hashtags.extend(["#RenewableEnergy", "#CleanEnergy", "#GreenEnergy"])
    if 'water' in topic.lower():
        topic_hashtags.extend(["#WaterConservation", "#CleanWater", "#WaterCrisis"])
    if 'forest' in topic.lower():
        topic_hashtags.extend(["#ForestConservation", "#Deforestation", "#Reforestation"])
    
    # Combine and deduplicate
    all_hashtags = list(set(base_hashtags + topic_hashtags))
    return random.sample(all_hashtags, min(5, len(all_hashtags)))

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_content(request):
    """Generate AI-powered content based on topic and type"""
    try:
        topic = request.data.get('topic', '')
        content_type = request.data.get('type', 'social_media_post')
        
        if not topic:
            return Response({'error': 'Topic is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Try OpenAI first
        client = get_openai_client()
        if client:
            try:
                prompt = f"""
                Generate a {content_type} about {topic} that is:
                - Engaging and inspiring
                - Focused on climate action, sustainability, and environmental protection
                - Appropriate for a climate-focused social media platform
                - Between 100-200 words
                - Include relevant hashtags
                """
                
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=300,
                    temperature=0.7
                )
                
                content = response.choices[0].message.content
                
                # Extract hashtags from content
                hashtags = []
                words = content.split()
                for word in words:
                    if word.startswith('#') and len(word) > 1:
                        hashtags.append(word)
                
                return Response({
                    'content': content,
                    'hashtags': hashtags,
                    'full_content': content
                })
                
            except Exception as e:
                logger.error(f"OpenAI API error: {e}")
                # Fall through to fallback
        
        # Use fallback content generation
        logger.info("Using fallback content system instead")
        content = generate_fallback_content(topic, content_type)
        hashtags = generate_fallback_hashtags(topic)
        
        return Response({
            'content': content,
            'hashtags': hashtags,
            'full_content': content
        })
        
    except Exception as e:
        logger.error(f"Error in generate_content: {e}")
        return Response({
            'error': f'Failed to generate content: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def analyze_content(request):
    """Analyze content for climate relevance and appropriateness"""
    try:
        content = request.data.get('content', '')
        
        if not content:
            return Response({'error': 'Content is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Basic content analysis
        content_lower = content.lower()
        
        # Check for climate relevance
        climate_score = 0
        for keyword in CLIMATE_KEYWORDS:
            if keyword in content_lower:
                climate_score += 1
        
        # Check for inappropriate content
        has_bad_words = any(word in content_lower for word in BAD_WORDS)
        
        # Links are allowed in posts; still reported for UI hints.
        has_links = any(
            token in content_lower for token in ("http://", "https://", "www.")
        )
        
        # Determine if content is appropriate
        is_climate_relevant = climate_score > 0
        is_appropriate = not has_bad_words
        is_suitable = is_climate_relevant and is_appropriate
        
        return Response({
            'is_climate_relevant': is_climate_relevant,
            'is_appropriate': is_appropriate,
            'is_suitable': is_suitable,
            'climate_score': climate_score,
            'has_links': has_links,
            'has_bad_words': has_bad_words,
            'suggestions': [
                'Focus on climate and environmental topics',
                'Use positive, constructive language',
            ] if not is_suitable else []
        })
        
    except Exception as e:
        logger.error(f"Error in analyze_content: {e}")
        return Response({
            'error': f'Failed to analyze content: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_hashtags(request):
    """Generate relevant hashtags for content"""
    try:
        content = request.data.get('content', '')
        topic = request.data.get('topic', '')
        
        if not content and not topic:
            return Response({'error': 'Content or topic is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Try OpenAI first
        client = get_openai_client()
        if client:
            try:
                prompt = f"""
                Generate 5-8 relevant hashtags for this content about climate and environment:
                Content: {content}
                Topic: {topic}
                
                Focus on:
                - Climate action and environmental protection
                - Sustainability and green living
                - Renewable energy and conservation
                - Make them specific and actionable
                """
                
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=150,
                    temperature=0.7
                )
                
                hashtags_text = response.choices[0].message.content
                
                # Extract hashtags
                hashtags = []
                words = hashtags_text.split()
                for word in words:
                    if word.startswith('#') and len(word) > 1:
                        hashtags.append(word)
                
                return Response({'hashtags': hashtags})
                
            except Exception as e:
                logger.error(f"OpenAI API error: {e}")
                # Fall through to fallback
        
        # Use fallback hashtag generation
        hashtags = generate_fallback_hashtags(topic or content)
        
        return Response({'hashtags': hashtags})
        
    except Exception as e:
        logger.error(f"Error in generate_hashtags: {e}")
        return Response({
            'error': f'Failed to generate hashtags: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)