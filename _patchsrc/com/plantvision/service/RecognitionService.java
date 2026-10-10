package com.plantvision.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.plantvision.config.AppProperties;
import com.plantvision.dto.DashboardStatsView;
import com.plantvision.dto.RecognitionCandidateView;
import com.plantvision.dto.RecognitionHistoryView;
import com.plantvision.dto.RecognitionResultView;
import com.plantvision.entity.PlantSpecies;
import com.plantvision.entity.RecognitionRecord;
import com.plantvision.mapper.RecognitionRecordMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.OpenOption;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class RecognitionService {
  private final AppProperties appProperties;
  private final BaiduPlantClient baiduPlantClient;
  private final PlantLibraryService plantLibraryService;
  private final RecognitionRecordMapper recognitionRecordMapper;

  public RecognitionService(
      AppProperties appProperties,
      BaiduPlantClient baiduPlantClient,
      PlantLibraryService plantLibraryService,
      RecognitionRecordMapper recognitionRecordMapper) {
    this.appProperties = appProperties;
    this.baiduPlantClient = baiduPlantClient;
    this.plantLibraryService = plantLibraryService;
    this.recognitionRecordMapper = recognitionRecordMapper;
  }

  public RecognitionResultView identify(MultipartFile image) throws Exception {
    if (image == null || image.isEmpty()) {
      throw new IllegalArgumentException("请上传植物图片。");
    }

    byte[] bytes = image.getBytes();
    String imageUrl = saveImage(image, bytes);

    List<PlantAiCandidate> aiCandidates = baiduPlantClient.identify(bytes);
    boolean usedAi = !aiCandidates.isEmpty();
    List<PlantAiCandidate> candidates =
        usedAi ? aiCandidates : ensureFallbackCandidates(plantLibraryService.demoCandidates(image.getOriginalFilename()));

    PlantSpecies matchedPlant = resolveBestMatch(candidates);
    String mode = usedAi ? "百度 AI 识别" : "演示模式";
    String recognizedName =
        matchedPlant != null ? matchedPlant.getChineseName() : candidates.getFirst().name();

    RecognitionRecord record =
        RecognitionRecord.builder()
            .imageName(image.getOriginalFilename())
            .imageUrl(imageUrl)
            .recognizedName(recognizedName)
            .matchedPlantId(matchedPlant != null ? matchedPlant.getId() : null)
            .confidence(
                BigDecimal.valueOf(candidates.getFirst().confidence())
                    .setScale(2, RoundingMode.HALF_UP))
            .recognitionMode(mode)
            .candidateNames(
                candidates.stream().map(PlantAiCandidate::name).collect(Collectors.joining(",")))
            .createdAt(LocalDateTime.now())
            .build();
    recognitionRecordMapper.insert(record);

    String message =
        usedAi
            ? "已完成智能识别，并结合站内图鉴给出更稳妥的匹配结果。"
            : "当前未连通外部 AI，已按站内图鉴与关键词规则给出候选结果。";

    return new RecognitionResultView(
        record.getId(),
        imageUrl,
        image.getOriginalFilename(),
        mode,
        message,
        matchedPlant == null ? null : plantLibraryService.toView(matchedPlant),
        candidates.stream()
            .map(candidate -> new RecognitionCandidateView(candidate.name(), candidate.confidence()))
            .toList());
  }

  public List<RecognitionHistoryView> history() {
    return recognitionRecordMapper
        .selectList(
            (Wrapper<RecognitionRecord>)
                new LambdaQueryWrapper<RecognitionRecord>()
                    .orderByDesc(RecognitionRecord::getCreatedAt)
                    .orderByDesc(RecognitionRecord::getId))
        .stream()
        .limit(8)
        .map(RecognitionHistoryView::from)
        .toList();
  }

  public DashboardStatsView mergeRecognitionStats(DashboardStatsView source) {
    long recognitionCount = recognitionRecordMapper.selectCount(null).longValue();
    return new DashboardStatsView(
        source.plantCount(), source.categoryCount(), source.sceneCount(), recognitionCount);
  }

  private String saveImage(MultipartFile image, byte[] bytes) throws Exception {
    String extension = StringUtils.getFilenameExtension(image.getOriginalFilename());
    String filename = UUID.randomUUID() + (extension == null ? ".jpg" : "." + extension);
    Path uploadPath = Paths.get(appProperties.getUploadDir()).toAbsolutePath().normalize();
    Files.createDirectories(uploadPath);
    Files.write(uploadPath.resolve(filename), bytes, new OpenOption[0]);
    return "/uploads/" + filename;
  }

  private List<PlantAiCandidate> ensureFallbackCandidates(List<PlantAiCandidate> candidates) {
    if (candidates != null && !candidates.isEmpty()) {
      return sortCandidates(candidates);
    }

    List<PlantAiCandidate> fallback = new ArrayList<>();
    for (PlantSpecies plant : plantLibraryService.hotPlants()) {
      fallback.add(new PlantAiCandidate(plant.getChineseName(), 55 - fallback.size() * 5));
      if (fallback.size() >= 5) {
        break;
      }
    }
    return sortCandidates(fallback);
  }

  private PlantSpecies resolveBestMatch(List<PlantAiCandidate> candidates) {
    PlantSpecies exact = plantLibraryService.findBestMatch(candidates);
    if (exact != null) {
      return exact;
    }

    List<PlantSpecies> plants = plantLibraryService.listForAdmin();
    PlantSpecies bestPlant = null;
    int bestScore = Integer.MIN_VALUE;

    for (PlantAiCandidate candidate : candidates) {
      for (PlantSpecies plant : plants) {
        int score = similarityScore(candidate.name(), plant) + candidate.confidence();
        if (score > bestScore) {
          bestScore = score;
          bestPlant = plant;
        }
      }
    }

    return bestScore >= 110 ? bestPlant : null;
  }

  private List<PlantAiCandidate> sortCandidates(List<PlantAiCandidate> candidates) {
    return candidates.stream()
        .filter(candidate -> candidate != null && !normalize(candidate.name()).isBlank())
        .sorted(Comparator.comparingInt(PlantAiCandidate::confidence).reversed())
        .limit(5)
        .toList();
  }

  private int similarityScore(String candidateName, PlantSpecies plant) {
    String candidate = normalize(candidateName);
    if (candidate.isBlank() || plant == null) {
      return Integer.MIN_VALUE / 4;
    }

    int best = 0;
    best = Math.max(best, scoreAgainstValue(candidate, plant.getChineseName(), 120));
    best = Math.max(best, scoreAgainstValue(candidate, plant.getLatinName(), 110));
    best = Math.max(best, scoreAgainstAliases(candidate, plant.getAliasName()));
    best = Math.max(best, scoreAgainstValue(candidate, plant.getCategory(), 45));
    best = Math.max(best, scoreAgainstValue(candidate, plant.getSceneTag(), 30));
    return best;
  }

  private int scoreAgainstAliases(String candidate, String aliasGroup) {
    if (aliasGroup == null || aliasGroup.isBlank()) {
      return 0;
    }

    int best = 0;
    for (String alias : aliasGroup.split("[、，,;；/\\\\|\\s]+")) {
      best = Math.max(best, scoreAgainstValue(candidate, alias, 105));
    }
    return best;
  }

  private int scoreAgainstValue(String candidate, String rawValue, int baseScore) {
    String value = normalize(rawValue);
    if (value.isBlank()) {
      return 0;
    }

    if (candidate.equals(value)) {
      return baseScore + 80;
    }
    if (value.contains(candidate) || candidate.contains(value)) {
      return baseScore + 45;
    }

    String[] candidateTokens = candidate.split("\\s+");
    for (String token : candidateTokens) {
      if (token.length() >= 2 && value.contains(token)) {
        return baseScore + 22;
      }
    }

    return 0;
  }

  private String normalize(String value) {
    if (value == null) {
      return "";
    }

    return value
        .toLowerCase(Locale.ROOT)
        .replaceAll("[（(].*?[)）]", " ")
        .replaceAll("[^\\p{IsHan}a-z0-9]+", " ")
        .trim();
  }
}
