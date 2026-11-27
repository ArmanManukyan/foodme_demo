package am.foodme.backend.model;

import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.SequenceGenerator;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests run on H2 with ddl-auto=create-drop, so the schema comes from the entity and never from
 * Flyway. This test catches the gap that H2 hides: the id strategy of OrderReview must match
 * V4__order_review.sql on PostgreSQL. (order_dish_addition is the cautionary example: its
 * entity uses IDENTITY but its column has no default, so production inserts NULL ids.)
 */
class OrderReviewMigrationTest {

    private static final String MIGRATION = "db/migration/V4__order_review.sql";

    private static String migrationSql() throws IOException {
        try (InputStream in = OrderReviewMigrationTest.class.getClassLoader().getResourceAsStream(MIGRATION)) {
            assertThat(in).as(MIGRATION + " on the classpath").isNotNull();
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static Field idField() throws NoSuchFieldException {
        return OrderReview.class.getDeclaredField("id");
    }

    @Test
    void idGeneration_matchesMigration() throws Exception {
        String sql = migrationSql().toLowerCase();
        GeneratedValue generatedValue = idField().getAnnotation(GeneratedValue.class);
        assertThat(generatedValue).as("@GeneratedValue on OrderReview.id").isNotNull();

        if (generatedValue.strategy() == GenerationType.IDENTITY) {
            assertThat(sql).as("IDENTITY needs an identity id column")
                    .containsPattern("id\\s+bigint\\s+generated\\s+(always|by\\s+default)\\s+as\\s+identity");
            return;
        }

        assertThat(generatedValue.strategy()).isEqualTo(GenerationType.SEQUENCE);
        SequenceGenerator generator = idField().getAnnotation(SequenceGenerator.class);
        assertThat(generator).as("@SequenceGenerator on OrderReview.id").isNotNull();
        String sequence = Pattern.quote(generator.sequenceName().toLowerCase());

        assertThat(sql).as("migration creates the entity's sequence with INCREMENT BY = allocationSize")
                .containsPattern("create\\s+sequence\\s+" + sequence
                        + "\\s+start\\s+with\\s+\\d+\\s+increment\\s+by\\s+" + generator.allocationSize() + "\\s*;");
        assertThat(sql).as("id column defaults to the same sequence")
                .containsPattern("id\\s+bigint\\s+not\\s+null\\s+primary\\s+key\\s+default\\s+nextval\\('"
                        + sequence + "'\\)");
    }

    @Test
    void reviewConstraints_matchMigration() throws Exception {
        String sql = migrationSql().toLowerCase();

        assertThat(sql).contains("order_id bigint not null unique");
        assertThat(sql).contains("check (stars between " + OrderReview.MIN_STARS + " and " + OrderReview.MAX_STARS + ")");
        assertThat(sql).contains("comment varchar(" + OrderReview.MAX_COMMENT_LENGTH + ")");
    }
}
