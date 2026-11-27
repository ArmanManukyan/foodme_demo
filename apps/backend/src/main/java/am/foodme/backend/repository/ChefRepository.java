package am.foodme.backend.repository;

import am.foodme.backend.model.Chef;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ChefRepository extends JpaRepository<Chef, Long> {
    Page<Chef> findByStatusOrderByPriorityIndexAscIdAsc(String status, Pageable pageable);

    Optional<Chef> findByUsername(String username);

    Page<Chef> findByUsernameContainingIgnoreCase(String q, Pageable pageable);

    /** Locks the chef row until the transaction ends, so concurrent rating updates don't overwrite each other. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Chef c WHERE c.id = :id")
    Optional<Chef> findByIdForUpdate(@Param("id") Long id);
}
